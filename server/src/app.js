import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import productsRouter from "./routes/products.js";
import showsRouter from "./routes/shows.js";
import modelsRouter from "./routes/models.js";
import authRoutes from "./routes/auth.js";
import ordersRouter from "./routes/orders.js";
import adminRouter from "./routes/admin.js";

export const app = express();
const allowedOrigin = process.env.CLIENT_URL || "http://localhost:5173";

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: allowedOrigin, methods: ["GET", "POST", "PATCH", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization"] }));
app.use(express.json({ limit: "32kb", strict: true }));

app.get("/api/health", (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ status: connected ? "ok" : "degraded", service: "velora-api", stage: "stage-3-auth-and-mongodb", database: connected ? "connected" : "disconnected", databaseState: mongoose.connection.readyState });
});

app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: "draft-7", legacyHeaders: false }), authRoutes);
app.use("/api/products", productsRouter);
app.use("/api/orders", rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: "draft-7", legacyHeaders: false }), ordersRouter);
app.use("/api/admin", adminRouter);
app.use("/api/shows", showsRouter);
app.use("/api/models", modelsRouter);

app.use((req, res) => res.status(404).json({ error: "Route not found", path: req.path }));
app.use((err, _req, res, _next) => {
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Request body too large." });
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Malformed JSON body." });
  if (err?.name === "ValidationError" || err?.name === "CastError") return res.status(400).json({ error: "Invalid data supplied." });
  console.error("Unhandled request error:", err?.message || "unknown error");
  return res.status(500).json({ error: "Internal server error." });
});

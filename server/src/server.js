import "dotenv/config";
import { app } from "./app.js";
import { connectDatabase } from "./config/db.js";

const PORT = Number(process.env.PORT || 5000);
try {
  await connectDatabase();
  app.listen(PORT, () => {
    console.log(`VÉLORA API running at http://localhost:${PORT}`);
    console.log(`Allowed frontend origin: ${process.env.CLIENT_URL || "http://localhost:5173"}`);
  });
} catch (error) {
  console.error(`Startup failed: ${error.message}`);
  console.error("Check server/.env, Atlas Network Access, database user, and connection string.");
  process.exit(1);
}

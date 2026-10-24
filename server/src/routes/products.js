import { Router } from "express";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

export function serializeProduct(p, { includeOwner = false } = {}) {
  const out = {
    id: String(p._id),
    slug: p.slug,
    name: p.name,
    designer: p.designer,
    category: p.category,
    price: p.price,
    currency: p.currency,
    tag: p.tag,
    description: p.description,
    image: p.images?.[0]?.url || "",
    images: p.images || [],
    sizes: p.sizes || [],
    colors: p.colors || [],
    material: p.material || "",
    care: p.care || "",
    details: p.details || [],
    inventory: p.inventory,
    designerVerified: Boolean(p.designerVerified)
  };
  if (includeOwner) {
    out.isPublished = p.isPublished;
    out.isFeatured = p.isFeatured;
    out.createdBy = p.createdBy ? String(p.createdBy) : null;
  }
  return out;
}

const list = (value, maxItems, maxLen) =>
  (Array.isArray(value) ? value : String(value ?? "").split(","))
    .map((v) => String(v).trim().slice(0, maxLen)).filter(Boolean).slice(0, maxItems);

// Whitelist of fields a manager may set. Anything else in the body is ignored (no mass-assignment).
function pickEditable(body = {}) {
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  if (has("name")) out.name = String(body.name).trim();
  if (has("designer")) out.designer = String(body.designer).trim();
  if (has("category")) out.category = String(body.category).trim();
  if (has("price")) out.price = Number(body.price);
  if (has("tag")) out.tag = String(body.tag).trim();
  if (has("description")) out.description = String(body.description).trim();
  if (has("material")) out.material = String(body.material).trim();
  if (has("care")) out.care = String(body.care).trim();
  if (has("sizes")) out.sizes = list(body.sizes, 12, 20);
  if (has("colors")) out.colors = list(body.colors, 12, 40);
  if (has("details")) out.details = (Array.isArray(body.details) ? body.details : String(body.details ?? "").split("\n")).map((v) => String(v).trim().slice(0, 200)).filter(Boolean).slice(0, 12);
  if (has("inventory")) out.inventory = Number(body.inventory);
  if (has("isPublished")) out.isPublished = Boolean(body.isPublished);
  if (has("isFeatured")) out.isFeatured = Boolean(body.isFeatured);
  if (has("images")) {
    out.images = (Array.isArray(body.images) ? body.images : [])
      .map((i) => (typeof i === "string" ? { url: i } : i))
      .filter((i) => i && typeof i.url === "string" && i.url.trim())
      .slice(0, 12)
      .map((i) => ({ url: i.url.trim(), alt: String(i.alt || "").slice(0, 180), view: String(i.view || "Editorial").slice(0, 60) }));
  }
  return out;
}

function validateNumbers(data) {
  if ("price" in data && (!Number.isFinite(data.price) || data.price < 0)) return "Price must be a positive number.";
  if ("inventory" in data && (!Number.isInteger(data.inventory) || data.inventory < 0)) return "Stock must be a whole number, zero or more.";
  return null;
}

async function uniqueSlug(name) {
  const base = String(name).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "product";
  let slug = base, n = 1;
  while (await Product.exists({ slug })) slug = `${base}-${++n}`;
  return slug;
}

// Public catalogue ------------------------------------------------------------
router.get("/", async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim().slice(0, 100);
    const category = String(req.query.category || "").trim();
    const filter = { isPublished: true };
    if (category) filter.category = category;
    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: safe, $options: "i" } },
        { designer: { $regex: safe, $options: "i" } },
        { category: { $regex: safe, $options: "i" } }
      ];
    }
    const records = await Product.find(filter).sort({ isFeatured: -1, createdAt: -1 }).limit(100).lean();
    res.json(records.map((p) => serializeProduct(p)));
  } catch (error) { next(error); }
});

// Management (admin sees everything; designers see only their own) -------------
router.get("/manage/list", requireAuth, requireRole("admin", "designer"), async (req, res, next) => {
  try {
    const filter = req.userProfile.role === "admin" ? {} : { createdBy: req.userProfile._id };
    const records = await Product.find(filter).sort({ createdAt: -1 }).limit(300).lean();
    res.json(records.map((p) => serializeProduct(p, { includeOwner: true })));
  } catch (error) { next(error); }
});

router.post("/", requireAuth, requireRole("admin", "designer"), async (req, res, next) => {
  try {
    const data = pickEditable(req.body);
    const numberError = validateNumbers(data);
    if (numberError) return res.status(400).json({ error: numberError });
    if (!data.name) return res.status(400).json({ error: "Product name is required." });
    if (req.userProfile.role !== "admin") delete data.isFeatured; // featuring is an editorial (admin) decision
    if (!data.designer) data.designer = req.userProfile.fullName || req.userProfile.email;
    const product = await Product.create({ ...data, slug: await uniqueSlug(data.name), createdBy: req.userProfile._id });
    res.status(201).json(serializeProduct(product.toObject(), { includeOwner: true }));
  } catch (error) { next(error); }
});

router.patch("/:id", requireAuth, requireRole("admin", "designer"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid product ID." });
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    const isAdmin = req.userProfile.role === "admin";
    if (!isAdmin && String(product.createdBy) !== String(req.userProfile._id)) {
      return res.status(403).json({ error: "You can only edit products you created." });
    }
    const data = pickEditable(req.body);
    const numberError = validateNumbers(data);
    if (numberError) return res.status(400).json({ error: numberError });
    if (!isAdmin) delete data.isFeatured; // featuring is an editorial decision
    product.set(data);
    await product.save();
    res.json(serializeProduct(product.toObject(), { includeOwner: true }));
  } catch (error) { next(error); }
});

// Public detail (published only). Keep after the fixed paths above. ------------
router.get("/:id", async (req, res, next) => {
  try {
    const product = await Product.findOne({ $or: [{ slug: req.params.id }, ...(/^[a-f\d]{24}$/i.test(req.params.id) ? [{ _id: req.params.id }] : [])], isPublished: true }).lean();
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(serializeProduct(product));
  } catch (error) { next(error); }
});

export default router;

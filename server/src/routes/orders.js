import { Router } from "express";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order, { ORDER_STATUSES } from "../models/Order.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const text = (value, max) => String(value ?? "").trim().slice(0, max);

function parseShipping(input = {}) {
  const shipping = {
    fullName: text(input.fullName, 120),
    phone: text(input.phone, 20),
    line1: text(input.line1, 200),
    line2: text(input.line2, 200),
    city: text(input.city, 80),
    state: text(input.state, 80),
    postalCode: text(input.postalCode, 12)
  };
  const missing = ["fullName", "phone", "line1", "city", "state", "postalCode"].filter((k) => !shipping[k]);
  if (missing.length) return { error: `Missing shipping details: ${missing.join(", ")}.` };
  if (!/^[0-9+\-\s]{7,20}$/.test(shipping.phone)) return { error: "Enter a valid phone number." };
  if (!/^[0-9]{6}$/.test(shipping.postalCode)) return { error: "Enter a valid 6-digit PIN code." };
  return { shipping };
}

function makeOrderNumber() {
  return `VEL-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

export function serializeOrder(o) {
  const plain = typeof o.toObject === "function" ? o.toObject() : o;
  return {
    id: String(plain._id),
    orderNumber: plain.orderNumber,
    status: plain.status,
    paymentMethod: plain.paymentMethod,
    paymentStatus: plain.paymentStatus,
    currency: plain.currency,
    subtotal: plain.subtotal,
    shippingFee: plain.shippingFee,
    total: plain.total,
    items: (plain.items || []).map((i) => ({ product: String(i.product), slug: i.slug, name: i.name, designer: i.designer, image: i.image, size: i.size, unitPrice: i.unitPrice, quantity: i.quantity })),
    shipping: plain.shipping,
    customer: plain.user && plain.user.email ? { id: String(plain.user._id), email: plain.user.email, fullName: plain.user.fullName } : undefined,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
}

async function restock(items) {
  await Promise.all(items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { inventory: i.quantity } })));
}

// POST /api/orders — create an order. Prices and stock are always read from the database, never from the browser.
router.post("/", requireAuth, async (req, res, next) => {
  const reserved = [];
  try {
    const { items, shipping: rawShipping, paymentMethod = "cod" } = req.body || {};
    if (paymentMethod !== "cod") return res.status(400).json({ error: "Only cash on delivery is available right now." });
    if (!Array.isArray(items) || items.length < 1 || items.length > 20) return res.status(400).json({ error: "Your bag must contain between 1 and 20 line items." });
    const { shipping, error } = parseShipping(rawShipping);
    if (error) return res.status(400).json({ error });

    // Merge duplicate product+size lines and validate each line.
    const lines = new Map();
    for (const raw of items) {
      const productId = String(raw?.productId || "");
      const quantity = Number(raw?.quantity);
      if (!mongoose.isValidObjectId(productId)) return res.status(400).json({ error: "One of the items in your bag is no longer available. Please refresh the page and add it again." });
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return res.status(400).json({ error: "Quantity must be a whole number between 1 and 10." });
      const size = text(raw?.size, 20);
      const key = `${productId}|${size}`;
      const existing = lines.get(key);
      lines.set(key, { productId, size, quantity: (existing?.quantity || 0) + quantity });
    }

    const orderItems = [];
    for (const line of lines.values()) {
      const product = await Product.findOne({ _id: line.productId, isPublished: true }).lean();
      if (!product) return res.status(400).json({ error: "One of the items in your bag is no longer available." });
      if (product.sizes?.length && !product.sizes.includes(line.size)) return res.status(400).json({ error: `Please choose a size for ${product.name}.` });
      if (line.quantity > 10) return res.status(400).json({ error: "Quantity must be 10 or fewer per item." });

      // Atomic stock reservation: only succeeds if enough stock remains.
      const updated = await Product.findOneAndUpdate(
        { _id: product._id, isPublished: true, inventory: { $gte: line.quantity } },
        { $inc: { inventory: -line.quantity } },
        { new: true }
      ).lean();
      if (!updated) {
        await restock(reserved);
        return res.status(409).json({ error: `Only ${product.inventory} of ${product.name} left in stock.` });
      }
      const item = { product: product._id, quantity: line.quantity };
      reserved.push(item);
      orderItems.push({ product: product._id, slug: product.slug, name: product.name, designer: product.designer, image: product.images?.[0]?.url || "", size: line.size, unitPrice: product.price, quantity: line.quantity });
    }

    const subtotal = orderItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const order = await Order.create({
      orderNumber: makeOrderNumber(),
      user: req.userProfile._id,
      items: orderItems,
      shipping,
      paymentMethod: "cod",
      subtotal,
      shippingFee: 0,
      total: subtotal
    });
    return res.status(201).json({ order: serializeOrder(order) });
  } catch (error) {
    if (reserved.length) await restock(reserved).catch(() => {});
    next(error);
  }
});

// GET /api/orders/mine — the signed-in user's own orders.
router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.userProfile._id }).sort({ createdAt: -1 }).limit(100);
    res.json(orders.map(serializeOrder));
  } catch (error) { next(error); }
});

// PATCH /api/orders/:id/cancel — a customer may cancel their own order until it ships.
router.patch("/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid order ID." });
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, user: req.userProfile._id, status: { $in: ["placed", "confirmed"] } },
      { $set: { status: "cancelled" } },
      { new: true }
    );
    if (!order) return res.status(409).json({ error: "This order can no longer be cancelled." });
    await restock(order.items);
    res.json({ order: serializeOrder(order) });
  } catch (error) { next(error); }
});

// GET /api/orders — admin: all orders with customer details.
router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const filter = ORDER_STATUSES.includes(req.query.status) ? { status: req.query.status } : {};
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(200).populate("user", "email fullName");
    res.json(orders.map(serializeOrder));
  } catch (error) { next(error); }
});

// PATCH /api/orders/:id/status — admin: move an order through its lifecycle.
router.patch("/:id/status", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid order ID." });
    if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: `Status must be one of: ${ORDER_STATUSES.join(", ")}.` });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found." });
    if (order.status === "cancelled") return res.status(409).json({ error: "A cancelled order cannot be changed." });
    if (status === "cancelled") await restock(order.items);
    order.status = status;
    if (status === "delivered") order.paymentStatus = "paid"; // cash collected on delivery
    await order.save();
    await order.populate("user", "email fullName");
    res.json({ order: serializeOrder(order) });
  } catch (error) { next(error); }
});

export default router;

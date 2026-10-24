import { Router } from "express";
import UserProfile from "../models/UserProfile.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireRole("admin"));

// GET /api/admin/summary — headline numbers for the admin dashboard.
router.get("/summary", async (_req, res, next) => {
  try {
    const [usersByRole, productCount, publishedCount, lowStock, orderStats, byStatus] = await Promise.all([
      UserProfile.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
      Product.countDocuments({}),
      Product.countDocuments({ isPublished: true }),
      Product.find({ inventory: { $lte: 2 } }).select("name slug inventory isPublished").sort({ inventory: 1 }).limit(10).lean(),
      Order.aggregate([{ $match: { status: { $ne: "cancelled" } } }, { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } }]),
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
    ]);
    res.json({
      users: Object.fromEntries(usersByRole.map((r) => [r._id, r.count])),
      products: { total: productCount, published: publishedCount },
      lowStock: lowStock.map((p) => ({ id: String(p._id), name: p.name, slug: p.slug, inventory: p.inventory, isPublished: p.isPublished })),
      orders: { count: orderStats[0]?.orders || 0, revenue: orderStats[0]?.revenue || 0, byStatus: Object.fromEntries(byStatus.map((r) => [r._id, r.count])) }
    });
  } catch (error) { next(error); }
});

// GET /api/admin/users — all profiles (for role assignment).
router.get("/users", async (_req, res, next) => {
  try {
    const users = await UserProfile.find({}).sort({ createdAt: -1 }).limit(200).select("email fullName role createdAt").lean();
    res.json(users.map((u) => ({ id: String(u._id), email: u.email, fullName: u.fullName, role: u.role, createdAt: u.createdAt })));
  } catch (error) { next(error); }
});

export default router;

import { Router } from "express";
import mongoose from "mongoose";
import UserProfile from "../models/UserProfile.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// GET /api/auth/me — validates the Supabase session and creates/updates the MongoDB profile.
router.get("/me", requireAuth, (req, res) => {
  const p = req.userProfile;
  return res.json({
    user: {
      id: p._id,
      supabaseUserId: p.supabaseUserId,
      email: p.email,
      fullName: p.fullName,
      avatarUrl: p.avatarUrl,
      role: p.role,
      createdAt: p.createdAt,
    },
  });
});

// Admins may assign operational roles. This endpoint intentionally cannot grant admin.
router.patch("/profiles/:profileId/role", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { profileId } = req.params;
    const { role } = req.body || {};
    const assignableRoles = ["customer", "model", "designer"];
    if (!mongoose.isValidObjectId(profileId)) return res.status(400).json({ error: "Invalid profile ID." });
    if (!assignableRoles.includes(role)) {
      return res.status(400).json({ error: "Role must be customer, model, or designer. Admin roles are provisioned separately." });
    }
    const profile = await UserProfile.findByIdAndUpdate(
      profileId,
      { $set: { role } },
      { new: true, runValidators: true }
    ).select("_id supabaseUserId email fullName role createdAt");
    if (!profile) return res.status(404).json({ error: "Profile not found." });
    return res.json({ user: profile });
  } catch (error) {
    console.error("Role assignment error:", error.message);
    return res.status(500).json({ error: "Could not update role." });
  }
});

// Example protected routes for later features:
router.get("/customer-area", requireAuth, requireRole("customer", "admin"), (req, res) => {
  res.json({ message: "Customer area access granted." });
});
router.get("/model-area", requireAuth, requireRole("model", "admin"), (req, res) => {
  res.json({ message: "Model area access granted." });
});
router.get("/designer-area", requireAuth, requireRole("designer", "admin"), (req, res) => {
  res.json({ message: "Designer area access granted." });
});
router.get("/admin-area", requireAuth, requireRole("admin"), (req, res) => {
  res.json({ message: "Admin area access granted." });
});

export default router;

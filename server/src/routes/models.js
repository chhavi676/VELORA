import { Router } from "express";
import ModelProfile from "../models/ModelProfile.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const specialty = String(req.query.specialty || "").trim();
    const filter = { isPublished: true };
    if (specialty) filter.specialties = specialty;
    const records = await ModelProfile.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json(records.map((model) => ({
      id: model._id.toString(),
      name: model.displayName,
      agency: model.agency,
      baseCity: model.baseCity,
      heightCm: model.heightCm,
      specialties: model.specialties,
      role: model.specialties.join(" · ").toUpperCase(),
      bio: model.bio,
      image: model.portraitUrl,
      portfolio: model.portfolio,
      isDemoProfile: model.isDemoProfile
    })));
  } catch (error) { next(error); }
});

export default router;
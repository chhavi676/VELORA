import { Router } from "express";
import RunwayShow from "../models/RunwayShow.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const records = await RunwayShow.find({ isPublished: true }).sort({ showDate: -1 }).limit(100).lean();
    res.json(records.map((show) => ({
      id: show._id.toString(),
      title: show.title,
      designer: show.designer,
      city: show.city,
      venue: show.venue,
      season: show.season,
      showDate: show.showDate,
      image: show.coverImage,
      gallery: show.gallery,
      videoUrl: show.videoUrl,
      description: show.description,
      sourceLabel: show.sourceLabel
    })));
  } catch (error) { next(error); }
});

export default router;
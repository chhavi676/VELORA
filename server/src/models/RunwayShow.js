import mongoose from "mongoose";

const runwayShowSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  designer: { type: String, required: true, trim: true, maxlength: 120 },
  city: { type: String, required: true, trim: true, maxlength: 80 },
  venue: { type: String, trim: true, maxlength: 160, default: "" },
  season: { type: String, required: true, trim: true, maxlength: 80 },
  showDate: { type: Date, required: true },
  coverImage: { type: String, required: true, match: /^https?:\/\/.+/i },
  gallery: {
    type: [{ type: String, trim: true, match: /^https?:\/\/.+/i }],
    default: [],
    validate: (items) => items.length <= 40
  },
  videoUrl: { type: String, trim: true, default: "" },
  description: { type: String, trim: true, maxlength: 2000, default: "" },
  sourceUrl: { type: String, trim: true, default: "" },
  sourceLabel: { type: String, trim: true, default: "Demo content" },
  isPublished: { type: Boolean, default: true, index: true }
}, { timestamps: true, versionKey: false });

runwayShowSchema.index({ city: 1, showDate: -1 });

export default mongoose.model("RunwayShow", runwayShowSchema);
import mongoose from "mongoose";

const portfolioImageSchema = new mongoose.Schema({
  url: { type: String, required: true, trim: true, match: /^https?:\/\/.+/i },
  caption: { type: String, trim: true, maxlength: 180, default: "" },
  type: { type: String, trim: true, enum: ["Portrait", "Runway", "Editorial", "Campaign", "Beauty"], default: "Editorial" }
}, { _id: false });

const modelProfileSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
  displayName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  agency: { type: String, trim: true, maxlength: 120, default: "Independent" },
  baseCity: { type: String, trim: true, maxlength: 100, default: "" },
  heightCm: { type: Number, min: 100, max: 230 },
  measurements: {
    bustCm: { type: Number, min: 0 },
    waistCm: { type: Number, min: 0 },
    hipsCm: { type: Number, min: 0 }
  },
  specialties: { type: [String], default: [], validate: (items) => items.length <= 20 },
  bio: { type: String, trim: true, maxlength: 2000, default: "" },
  portraitUrl: { type: String, required: true, match: /^https?:\/\/.+/i },
  portfolio: {
    type: [portfolioImageSchema],
    default: [],
    validate: (items) => items.length <= 40
  },
  bookingEmail: { type: String, trim: true, lowercase: true, maxlength: 254, default: "" },
  isPublished: { type: Boolean, default: true, index: true },
  isDemoProfile: { type: Boolean, default: true }
}, { timestamps: true, versionKey: false });

modelProfileSchema.index({ specialties: 1, isPublished: 1 });

export default mongoose.model("ModelProfile", modelProfileSchema);
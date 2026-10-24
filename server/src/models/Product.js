import mongoose from "mongoose";

const productImageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    trim: true,
    match: /^https?:\/\/.+/i
  },
  alt: { type: String, trim: true, maxlength: 180, default: "" },
  view: { type: String, trim: true, maxlength: 60, default: "Editorial" }
}, { _id: false });

const productSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 140 },
  designer: { type: String, required: true, trim: true, maxlength: 120 },
  category: {
    type: String, required: true, trim: true,
    enum: ["Dresses", "Tailoring", "Accessories", "Shoes", "Outerwear", "Jewellery", "Bags"]
  },
  price: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "INR", enum: ["INR"], required: true },
  tag: { type: String, trim: true, maxlength: 50, default: "CURATED EDIT" },
  description: { type: String, required: true, trim: true, maxlength: 1200 },
  images: {
    type: [productImageSchema],
    validate: {
      validator: (images) => images.length >= 1 && images.length <= 12,
      message: "A product must have between 1 and 12 images."
    }
  },
  sizes: { type: [{ type: String, trim: true, maxlength: 20 }], default: [], validate: (v) => v.length <= 12 },
  colors: { type: [{ type: String, trim: true, maxlength: 40 }], default: [], validate: (v) => v.length <= 12 },
  material: { type: String, trim: true, maxlength: 200, default: "" },
  care: { type: String, trim: true, maxlength: 300, default: "" },
  details: { type: [{ type: String, trim: true, maxlength: 200 }], default: [], validate: (v) => v.length <= 12 },
  inventory: { type: Number, min: 0, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "UserProfile", default: null, index: true },
  isPublished: { type: Boolean, default: true, index: true },
  isFeatured: { type: Boolean, default: false },
  designerVerified: { type: Boolean, default: false }
}, { timestamps: true, versionKey: false });

productSchema.index({ name: "text", designer: "text", description: "text" });
productSchema.index({ category: 1, isPublished: 1, createdAt: -1 });

export default mongoose.model("Product", productSchema);
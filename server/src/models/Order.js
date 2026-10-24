import mongoose from "mongoose";

export const ORDER_STATUSES = ["placed", "confirmed", "shipped", "delivered", "cancelled"];

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  slug: { type: String, required: true },
  name: { type: String, required: true },
  designer: { type: String, default: "" },
  image: { type: String, default: "" },
  size: { type: String, default: "" },
  unitPrice: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1, max: 10 }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "UserProfile", required: true, index: true },
  items: { type: [orderItemSchema], validate: (v) => v.length >= 1 && v.length <= 20 },
  shipping: {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    line1: { type: String, required: true, trim: true, maxlength: 200 },
    line2: { type: String, trim: true, maxlength: 200, default: "" },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    state: { type: String, required: true, trim: true, maxlength: 80 },
    postalCode: { type: String, required: true, trim: true, maxlength: 12 }
  },
  paymentMethod: { type: String, enum: ["cod"], default: "cod", required: true },
  paymentStatus: { type: String, enum: ["pending", "paid", "refunded"], default: "pending" },
  currency: { type: String, default: "INR" },
  subtotal: { type: Number, required: true, min: 0 },
  shippingFee: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ORDER_STATUSES, default: "placed", index: true }
}, { timestamps: true, versionKey: false });

orderSchema.index({ createdAt: -1 });

export default mongoose.models.Order || mongoose.model("Order", orderSchema);

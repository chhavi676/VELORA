import mongoose from "mongoose";

const userProfileSchema = new mongoose.Schema(
  {
    supabaseUserId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    fullName: { type: String, trim: true, maxlength: 120, default: "" },
    avatarUrl: { type: String, trim: true, default: "" },
    role: {
      type: String,
      enum: ["customer", "model", "designer", "admin"],
      default: "customer",
      required: true,
    },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.models.UserProfile || mongoose.model("UserProfile", userProfileSchema);

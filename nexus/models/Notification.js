import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
   {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },
      title: { type: String, required: true, trim: true },
      message: { type: String, trim: true },
      type: {
         type: String,
         enum: ["info", "warning", "success", "error", "system"],
         default: "info",
      },
      read: { type: Boolean, default: false },
      link: { type: String, trim: true },
   },
   { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export default mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
   {
      key: { type: String, required: true, unique: true, trim: true },
      value: { type: mongoose.Schema.Types.Mixed },
      organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },
   },
   { timestamps: true }
);

export default mongoose.models.Setting || mongoose.model("Setting", settingSchema);

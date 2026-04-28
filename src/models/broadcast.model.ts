import mongoose, { Document, Schema } from "mongoose";

export interface IBroadcast extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  content: string;
  target: "all";
  createdAt: Date;
}

const broadcastSchema = new Schema<IBroadcast>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    target: { type: String, enum: ["all"], default: "all" },
  },
  { timestamps: true }
);

export const Broadcast = mongoose.model<IBroadcast>("Broadcast", broadcastSchema);

import mongoose, { Document, Schema } from "mongoose";

export interface IBroadcastAction {
  label: string;
  url: string;
}

export interface IBroadcast extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  content: string;
  target: "all";
  actionButton?: IBroadcastAction;
  createdAt: Date;
}

const broadcastSchema = new Schema<IBroadcast>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    target: { type: String, enum: ["all"], default: "all" },
    // Optional — a broadcast with no actionButton behaves exactly as before.
    actionButton: {
      type: new Schema<IBroadcastAction>(
        {
          label: { type: String, required: true, trim: true },
          url: { type: String, required: true, trim: true },
        },
        { _id: false }
      ),
      required: false,
    },
  },
  { timestamps: true }
);

export const Broadcast = mongoose.model<IBroadcast>("Broadcast", broadcastSchema);

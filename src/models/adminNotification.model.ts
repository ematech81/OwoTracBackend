import mongoose, { Document, Schema } from "mongoose";

export type AdminNotificationType = "NEW_USER" | "NEW_SUBSCRIPTION" | "PAYMENT_FAILED" | "SUBSCRIPTION_CANCELLED";

export interface IAdminNotification extends Document {
  _id: mongoose.Types.ObjectId;
  type: AdminNotificationType;
  message: string;
  isRead: boolean;
  metadata?: Record<string, string>;
  createdAt: Date;
}

const adminNotificationSchema = new Schema<IAdminNotification>(
  {
    type: { type: String, enum: ["NEW_USER", "NEW_SUBSCRIPTION", "PAYMENT_FAILED", "SUBSCRIPTION_CANCELLED"], required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

adminNotificationSchema.index({ createdAt: -1 });
adminNotificationSchema.index({ isRead: 1 });

export const AdminNotification = mongoose.model<IAdminNotification>("AdminNotification", adminNotificationSchema);

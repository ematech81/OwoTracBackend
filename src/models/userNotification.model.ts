import mongoose, { Document, Schema } from "mongoose";

export type UserNotificationType =
  | "SUBSCRIPTION_ACTIVATED"
  | "SUBSCRIPTION_CANCELLED"
  | "SUBSCRIPTION_EXPIRING"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED"
  | "ADMIN_BROADCAST"
  | "SYSTEM_ALERT";

export interface IUserNotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: UserNotificationType;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const userNotificationSchema = new Schema<IUserNotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["SUBSCRIPTION_ACTIVATED","SUBSCRIPTION_CANCELLED","SUBSCRIPTION_EXPIRING","PAYMENT_SUCCESS","PAYMENT_FAILED","ADMIN_BROADCAST","SYSTEM_ALERT"],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

userNotificationSchema.index({ userId: 1, createdAt: -1 });

export const UserNotification = mongoose.model<IUserNotification>(
  "UserNotification",
  userNotificationSchema
);

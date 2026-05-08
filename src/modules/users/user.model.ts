import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  pin: string;
  refreshToken?: string;
  isPhoneVerified: boolean;
  businessName?: string;
  businessType?: string;
  location: {
    country: string;
    state?: string;
    city?: string;
    market?: string;
  };
  preferredLanguage: "pidgin" | "english";
  currency: string;
  notifications: {
    dailyReminder: boolean;
    dailyReminderTime: string;
    weeklyReport: boolean;
    creditReminders: boolean;
    pushToken?: string;
  };
  subscription: {
    plan: "free" | "growth" | "pro" | "business";
    status: "active" | "inactive" | "cancelled" | "expired";
    startDate?: Date;
    expiresAt?: Date;
  };
  healthScore: number;
  loanEligible: boolean;
  referralCode: string;
  referredBy?: mongoose.Types.ObjectId;
  hasUsedReferralReward: boolean;
  referralRewardExpiresAt?: Date;
  streakDays: number;
  lastRecordDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true, sparse: true },
    pin: { type: String, required: true },
    refreshToken: { type: String },
    isPhoneVerified: { type: Boolean, default: false },
    businessName: { type: String, trim: true },
    businessType: {
      type: String,
      enum: [
        "food_items", "fashion_clothing", "electronics",
        "provisions", "raw_materials", "pharmacy",
        "cosmetics", "agriculture", "services", "other",
      ],
    },
    location: {
      country: { type: String, default: "Nigeria" },
      state: String,
      city: String,
      market: String,
    },
    preferredLanguage: {
      type: String,
      enum: ["pidgin", "english"],
      default: "pidgin",
    },
    currency: { type: String, default: "NGN" },
    notifications: {
      dailyReminder: { type: Boolean, default: true },
      dailyReminderTime: { type: String, default: "19:00" },
      weeklyReport: { type: Boolean, default: true },
      creditReminders: { type: Boolean, default: true },
      pushToken: String,
    },
    subscription: {
      plan: {
        type: String,
        enum: ["free", "growth", "pro", "business"],
        default: "free",
      },
      status: { type: String, enum: ["active", "inactive", "cancelled", "expired"], default: "inactive" },
      startDate: Date,
      expiresAt: Date,
    },
    healthScore: { type: Number, default: 0 },
    loanEligible: { type: Boolean, default: false },
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: Schema.Types.ObjectId, ref: "User" },
    hasUsedReferralReward: { type: Boolean, default: false },
    referralRewardExpiresAt: Date,
    streakDays: { type: Number, default: 0 },
    lastRecordDate: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);

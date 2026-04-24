import mongoose, { Document, Schema } from "mongoose";

export interface IExpense extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  date: Date;
  description: string;
  amount: number;
  category: string;
  isRecurring: boolean;
  recurringFrequency?: "daily" | "weekly" | "monthly" | "none";
  rawInput?: string;
  syncStatus: "synced" | "pending" | "failed";
  localId?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true, index: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: [
        "stock_purchase", "transportation", "market_levy",
        "shop_rent", "labor", "utilities", "communication",
        "packaging", "equipment", "personal",
        "loan_repayment", "other",
      ],
      default: "other",
    },
    isRecurring: { type: Boolean, default: false },
    recurringFrequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "none"],
      default: "none",
    },
    rawInput: String,
    syncStatus: { type: String, enum: ["synced", "pending", "failed"], default: "synced" },
    localId: { type: String, index: true, sparse: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, isDeleted: 1, date: -1 });

export const Expense = mongoose.model<IExpense>("Expense", expenseSchema);

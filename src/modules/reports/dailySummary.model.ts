import mongoose, { Document, Schema } from "mongoose";

export interface IDailySummary extends Document {
  userId: mongoose.Types.ObjectId;
  date: Date;
  totalSales: number;
  totalCostOfGoods: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  creditGiven: number;
  creditCollected: number;
  expenseBreakdown: {
    stock_purchase: number;
    transportation: number;
    market_levy: number;
    labor: number;
    utilities: number;
    other: number;
  };
  salesCount: number;
  paymentBreakdown: {
    cash: number;
    transfer: number;
    pos: number;
    credit: number;
    mixed: number;
  };
  bestProduct?: { name: string; amount: number };
  aiInsight?: string;
  createdAt: Date;
  updatedAt: Date;
}

const dailySummarySchema = new Schema<IDailySummary>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    totalSales: { type: Number, default: 0 },
    totalCostOfGoods: { type: Number, default: 0 },
    totalExpenses: { type: Number, default: 0 },
    grossProfit: { type: Number, default: 0 },
    netProfit: { type: Number, default: 0 },
    profitMargin: { type: Number, default: 0 },
    creditGiven: { type: Number, default: 0 },
    creditCollected: { type: Number, default: 0 },
    expenseBreakdown: {
      stock_purchase: { type: Number, default: 0 },
      transportation: { type: Number, default: 0 },
      market_levy: { type: Number, default: 0 },
      labor: { type: Number, default: 0 },
      utilities: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    salesCount: { type: Number, default: 0 },
    paymentBreakdown: {
      cash:     { type: Number, default: 0 },
      transfer: { type: Number, default: 0 },
      pos:      { type: Number, default: 0 },
      credit:   { type: Number, default: 0 },
      mixed:    { type: Number, default: 0 },
    },
    bestProduct: { name: String, amount: Number },
    aiInsight: String,
  },
  { timestamps: true }
);

dailySummarySchema.index({ userId: 1, date: -1 }, { unique: true });

export const DailySummary = mongoose.model<IDailySummary>("DailySummary", dailySummarySchema);

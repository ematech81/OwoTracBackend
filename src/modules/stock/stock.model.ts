import mongoose, { Document, Schema } from "mongoose";

export interface IStockItem extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  category: string;
  emoji: string;
  qty: number;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  dateEntered: Date;
  lowStockThreshold: number;
  syncStatus: "synced" | "pending" | "failed";
  localId?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const stockItemSchema = new Schema<IStockItem>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, default: "General", trim: true },
    emoji: { type: String, default: "📦" },
    qty: { type: Number, required: true, min: 0, default: 0 },
    unit: { type: String, default: "unit", trim: true },
    costPrice: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    dateEntered: { type: Date, required: true, default: Date.now },
    lowStockThreshold: { type: Number, default: 5 },
    syncStatus: { type: String, enum: ["synced", "pending", "failed"], default: "synced" },
    localId: { type: String, index: true, sparse: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

stockItemSchema.index({ userId: 1, isDeleted: 1 });
stockItemSchema.index({ userId: 1, dateEntered: -1 });

export const StockItem = mongoose.model<IStockItem>("StockItem", stockItemSchema);

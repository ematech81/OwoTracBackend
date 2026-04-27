import mongoose, { Document, Schema } from "mongoose";

export interface ISaleItem {
  productName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  costPrice: number;
  totalAmount: number;
  profit: number;
}

export interface ISale extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  date: Date;
  items: ISaleItem[];
  subtotal: number;
  discount: number;
  discountType: "fixed" | "percent";
  discountAmount: number;
  tax: number;
  taxAmount: number;
  totalAmount: number;
  totalCostOfGoods: number;
  totalProfit: number;
  profitMargin: number;
  paymentType: "cash" | "transfer" | "pos" | "credit" | "mixed";
  inputMethod: "voice" | "text" | "manual_form";
  rawInput?: string;
  notes?: string;
  customerName?: string;
  invoiceNumber?: string;
  syncStatus: "synced" | "pending" | "failed";
  localId?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const saleItemSchema = new Schema<ISaleItem>(
  {
    productName: { type: String, required: true, trim: true },
    category: { type: String, default: "other" },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, default: "piece" },
    unitPrice: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    profit: { type: Number, default: 0 },
  },
  { _id: false }
);

const saleSchema = new Schema<ISale>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true, index: true },
    items: { type: [saleItemSchema], required: true },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0, min: 0 },
    discountType: { type: String, enum: ["fixed", "percent"], default: "fixed" },
    discountAmount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    totalCostOfGoods: { type: Number, default: 0 },
    totalProfit: { type: Number, default: 0 },
    profitMargin: { type: Number, default: 0 },
    paymentType: {
      type: String,
      enum: ["cash", "transfer", "pos", "credit", "mixed"],
      default: "cash",
    },
    inputMethod: {
      type: String,
      enum: ["voice", "text", "manual_form"],
      default: "manual_form",
    },
    rawInput: String,
    notes: String,
    customerName: { type: String, trim: true },
    invoiceNumber: { type: String, trim: true, index: true, sparse: true },
    syncStatus: {
      type: String,
      enum: ["synced", "pending", "failed"],
      default: "synced",
    },
    localId: { type: String, index: true, sparse: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

saleSchema.index({ userId: 1, date: -1 });
saleSchema.index({ userId: 1, isDeleted: 1, date: -1 });

export const Sale = mongoose.model<ISale>("Sale", saleSchema);

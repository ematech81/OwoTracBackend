import mongoose, { Document, Schema } from "mongoose";

export interface IPayment {
  amount: number;
  date: Date;
  note?: string; 
}

export interface ICredit extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone?: string;
  description: string;
  amount: number;       // original amount owed
  amountPaid: number;   // total paid back so far
  balance: number;      // amount - amountPaid
  dueDate: Date;
  status: "active" | "due_soon" | "overdue" | "paid";
  payments: IPayment[];
  localId?: string;
  syncStatus: "synced" | "pending" | "failed";
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>({
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true },
  note: String,
});

const creditSchema = new Schema<ICredit>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["active", "due_soon", "overdue", "paid"],
      default: "active",
      index: true,
    },
    payments: [paymentSchema],
    localId: { type: String, index: true, sparse: true },
    syncStatus: { type: String, enum: ["synced", "pending", "failed"], default: "synced" },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

creditSchema.index({ userId: 1, status: 1 });
creditSchema.index({ userId: 1, dueDate: 1 });
creditSchema.index({ userId: 1, isDeleted: 1, status: 1 });

// Auto-compute status and balance before save
creditSchema.pre("save", function (next) {
  this.balance = this.amount - this.amountPaid;
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (this.balance <= 0) {
    this.status = "paid";
  } else if (this.dueDate < now) {
    this.status = "overdue";
  } else if (this.dueDate <= sevenDays) {
    this.status = "due_soon";
  } else {
    this.status = "active";
  }
  next();
});

export const Credit = mongoose.model<ICredit>("Credit", creditSchema);

import { Sale, ISale, ISaleItem } from "./sale.model";
import { StockItem } from "../stock/stock.model";
import { User } from "../users/user.model";
import { AppError } from "../../middleware/errorHandler";
import { parseSaleText } from "../ai/parseService";
import mongoose from "mongoose";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function deductStock(userId: string, items: ISaleItem[]): Promise<void> {
  await Promise.all(
    items.map((item) =>
      StockItem.updateOne(
        {
          userId,
          isDeleted: false,
          name: { $regex: new RegExp(`^${escapeRegex(item.productName.trim())}$`, "i") },
        },
        [{ $set: { qty: { $max: [0, { $subtract: ["$qty", item.quantity] }] } } }]
      )
    )
  );
}

async function restoreStock(userId: string, items: ISaleItem[]): Promise<void> {
  await Promise.all(
    items.map((item) =>
      StockItem.updateOne(
        {
          userId,
          isDeleted: false,
          name: { $regex: new RegExp(`^${escapeRegex(item.productName.trim())}$`, "i") },
        },
        { $inc: { qty: item.quantity } }
      )
    )
  );
}

function computeTotals(
  items: ISaleItem[],
  discount = 0,
  discountType: "fixed" | "percent" = "fixed",
  tax = 0
) {
  const subtotal = items.reduce((s, i) => s + i.totalAmount, 0);
  const totalCostOfGoods = items.reduce((s, i) => s + i.costPrice * i.quantity, 0);

  const discountAmount = discountType === "percent"
    ? subtotal * discount / 100
    : Math.min(discount, subtotal);
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const taxAmount = afterDiscount * tax / 100;
  const totalAmount = afterDiscount + taxAmount;

  const totalProfit = afterDiscount - totalCostOfGoods;
  const profitMargin = subtotal > 0
    ? Math.round((totalProfit / subtotal) * 100 * 10) / 10
    : 0;

  return { subtotal, discountAmount, taxAmount, totalAmount, totalCostOfGoods, totalProfit, profitMargin };
}

async function updateStreak(userId: string): Promise<void> {
  const user = await User.findById(userId).select("streakDays lastRecordDate");
  if (!user) return;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const lastDate = user.lastRecordDate ? new Date(user.lastRecordDate) : null;
  if (lastDate) lastDate.setHours(0, 0, 0, 0);

  // Already recorded today — streak unchanged, just refresh the timestamp
  if (lastDate && lastDate.getTime() === todayStart.getTime()) return;

  const yesterday = new Date(todayStart);
  yesterday.setDate(yesterday.getDate() - 1);

  const newStreak =
    lastDate && lastDate.getTime() === yesterday.getTime()
      ? user.streakDays + 1   // consecutive day
      : 1;                     // first ever OR gap of 2+ days → reset

  await User.findByIdAndUpdate(userId, {
    streakDays: newStreak,
    lastRecordDate: todayStart,
  });
}

const enrichItems = (rawItems: Omit<ISaleItem, "profit" | "totalAmount">[]): ISaleItem[] =>
  rawItems.map((item) => ({
    ...item,
    totalAmount: item.unitPrice * item.quantity,
    profit: (item.unitPrice - item.costPrice) * item.quantity,
  }));

export const salesService = {
  async create(userId: string, body: {
    date: string;
    items: Omit<ISaleItem, "profit" | "totalAmount">[];
    paymentType: ISale["paymentType"];
    notes?: string;
    inputMethod: ISale["inputMethod"];
    rawInput?: string;
    localId?: string;
    customerName?: string;
    invoiceNumber?: string;
    discount?: number;
    discountType?: "fixed" | "percent";
    tax?: number;
  }) {
    const items = enrichItems(body.items);
    const totals = computeTotals(items, body.discount, body.discountType, body.tax);

    const sale = await Sale.create({
      userId,
      date: new Date(body.date),
      items,
      ...totals,
      discount: body.discount ?? 0,
      discountType: body.discountType ?? "fixed",
      tax: body.tax ?? 0,
      paymentType: body.paymentType,
      inputMethod: body.inputMethod,
      rawInput: body.rawInput,
      notes: body.notes,
      localId: body.localId,
      customerName: body.customerName,
      invoiceNumber: body.invoiceNumber,
      syncStatus: "synced",
    });

    await deductStock(userId, items);
    // Fire-and-forget — streak update must not block the sale response
    updateStreak(userId).catch(() => {});

    return sale;
  },

  async list(userId: string, query: {
    page: number;
    limit: number;
    startDate?: string;
    endDate?: string;
    category?: string;
    minAmount?: number;
    maxAmount?: number;
  }) {
    const filter: mongoose.FilterQuery<typeof Sale> = { userId, isDeleted: false };

    if (query.startDate || query.endDate) {
      filter.date = {};
      if (query.startDate) filter.date.$gte = new Date(query.startDate);
      if (query.endDate) filter.date.$lte = new Date(query.endDate);
    }
    if (query.category) filter["items.category"] = query.category;
    if (query.minAmount !== undefined) filter.totalAmount = { ...filter.totalAmount, $gte: query.minAmount };
    if (query.maxAmount !== undefined) filter.totalAmount = { ...filter.totalAmount, $lte: query.maxAmount };

    const skip = (query.page - 1) * query.limit;
    const [sales, total] = await Promise.all([
      Sale.find(filter).sort({ date: -1 }).skip(skip).limit(query.limit),
      Sale.countDocuments(filter),
    ]);

    return { sales, total, page: query.page, limit: query.limit };
  },

  async getById(userId: string, saleId: string) {
    const sale = await Sale.findOne({ _id: saleId, userId, isDeleted: false });
    if (!sale) throw new AppError(404, "Sale not found", "NOT_FOUND");
    return sale;
  },

  async update(userId: string, saleId: string, body: {
    date?: string;
    items?: Omit<ISaleItem, "profit" | "totalAmount">[];
    paymentType?: ISale["paymentType"];
    notes?: string;
  }) {
    const sale = await Sale.findOne({ _id: saleId, userId, isDeleted: false });
    if (!sale) throw new AppError(404, "Sale not found", "NOT_FOUND");

    if (body.date) sale.date = new Date(body.date);
    if (body.paymentType) sale.paymentType = body.paymentType;
    if (body.notes !== undefined) sale.notes = body.notes;

    if (body.items) {
      const oldItems = [...sale.items];
      const newItems = enrichItems(body.items);
      sale.items = newItems;
      const totals = computeTotals(newItems, sale.discount, sale.discountType, sale.tax);
      Object.assign(sale, totals);
      await sale.save();
      await restoreStock(userId, oldItems);
      await deductStock(userId, newItems);
    } else {
      await sale.save();
    }

    return sale;
  },

  async delete(userId: string, saleId: string) {
    const sale = await Sale.findOne({ _id: saleId, userId, isDeleted: false });
    if (!sale) throw new AppError(404, "Sale not found", "NOT_FOUND");
    sale.isDeleted = true;
    await sale.save();
    await restoreStock(userId, sale.items);
  },

  async parseText(input: string) {
    return parseSaleText(input);
  },
};

import { Sale, ISale, ISaleItem } from "./sale.model";
import { StockItem } from "../stock/stock.model";
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
        // Atomic: floor at 0 so qty never goes negative
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

const computeTotals = (items: ISaleItem[]) => {
  const totalAmount = items.reduce((s, i) => s + i.totalAmount, 0);
  const totalCostOfGoods = items.reduce((s, i) => s + i.costPrice * i.quantity, 0);
  const totalProfit = totalAmount - totalCostOfGoods;
  const profitMargin = totalAmount > 0 ? Math.round((totalProfit / totalAmount) * 100 * 10) / 10 : 0;
  return { totalAmount, totalCostOfGoods, totalProfit, profitMargin };
};

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
  }) {
    const items = enrichItems(body.items);
    const totals = computeTotals(items);

    const sale = await Sale.create({
      userId,
      date: new Date(body.date),
      items,
      ...totals,
      paymentType: body.paymentType,
      inputMethod: body.inputMethod,
      rawInput: body.rawInput,
      notes: body.notes,
      localId: body.localId,
      syncStatus: "synced",
    });

    await deductStock(userId, items);

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
      const totals = computeTotals(newItems);
      Object.assign(sale, totals);
      await sale.save();
      // Reverse the old deduction, apply the new one
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
    // Restore stock quantities since this sale is being undone
    await restoreStock(userId, sale.items);
  },

  async parseText(input: string) {
    return parseSaleText(input);
  },
};

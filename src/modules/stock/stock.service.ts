import { StockItem, IStockItem } from "./stock.model";
import { AppError } from "../../middleware/errorHandler";

export const stockService = {
  async create(userId: string, body: {
    name: string;
    category?: string;
    emoji?: string;
    qty: number;
    unit?: string;
    costPrice?: number;
    sellingPrice?: number;
    dateEntered: string;
    lowStockThreshold?: number;
    localId?: string;
  }) {
    return StockItem.create({
      userId,
      name: body.name,
      category: body.category ?? "General",
      emoji: body.emoji ?? "📦",
      qty: body.qty,
      unit: body.unit ?? "unit",
      costPrice: body.costPrice ?? 0,
      sellingPrice: body.sellingPrice ?? 0,
      dateEntered: new Date(body.dateEntered),
      lowStockThreshold: body.lowStockThreshold ?? 5,
      localId: body.localId,
      syncStatus: "synced",
    });
  },

  async list(userId: string, query: {
    page: number;
    limit: number;
    search?: string;
    category?: string;
  }) {
    const filter: Record<string, unknown> = { userId, isDeleted: false };

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: "i" } },
        { category: { $regex: query.search, $options: "i" } },
      ];
    }
    if (query.category) filter.category = query.category;

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      StockItem.find(filter).sort({ dateEntered: -1, createdAt: -1 }).skip(skip).limit(query.limit),
      StockItem.countDocuments(filter),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  },

  async getStats(userId: string) {
    const items = await StockItem.find({ userId, isDeleted: false });
    const totalValue = items.reduce((s, i) => s + i.qty * i.costPrice, 0);
    const lowCount = items.filter((i) => i.qty > 0 && i.qty <= i.lowStockThreshold).length;
    const outCount = items.filter((i) => i.qty === 0).length;
    const totalItems = items.length;
    return { totalValue, lowCount, outCount, totalItems };
  },

  async getById(userId: string, id: string) {
    const item = await StockItem.findOne({ _id: id, userId, isDeleted: false });
    if (!item) throw new AppError(404, "Stock item not found", "NOT_FOUND");
    return item;
  },

  async update(userId: string, id: string, body: Partial<IStockItem>) {
    const item = await StockItem.findOne({ _id: id, userId, isDeleted: false });
    if (!item) throw new AppError(404, "Stock item not found", "NOT_FOUND");

    if (body.name) item.name = body.name;
    if (body.category !== undefined) item.category = body.category;
    if (body.emoji) item.emoji = body.emoji;
    if (body.qty !== undefined) item.qty = body.qty;
    if (body.unit) item.unit = body.unit;
    if (body.costPrice !== undefined) item.costPrice = body.costPrice;
    if (body.sellingPrice !== undefined) item.sellingPrice = body.sellingPrice;
    if (body.dateEntered) item.dateEntered = body.dateEntered;
    if (body.lowStockThreshold !== undefined) item.lowStockThreshold = body.lowStockThreshold;

    await item.save();
    return item;
  },

  async adjustQty(userId: string, id: string, delta: number) {
    const item = await StockItem.findOne({ _id: id, userId, isDeleted: false });
    if (!item) throw new AppError(404, "Stock item not found", "NOT_FOUND");
    item.qty = Math.max(0, item.qty + delta);
    await item.save();
    return item;
  },

  async delete(userId: string, id: string) {
    const item = await StockItem.findOne({ _id: id, userId, isDeleted: false });
    if (!item) throw new AppError(404, "Stock item not found", "NOT_FOUND");
    item.isDeleted = true;
    await item.save();
  },
};

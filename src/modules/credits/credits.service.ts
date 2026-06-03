import { Credit, ICredit } from "./credit.model";
import { AppError } from "../../middleware/errorHandler";

const DUE_SOON_DAYS = 3;

async function refreshStatuses(): Promise<void> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const threeDaysFromNow = new Date(todayStart.getTime() + DUE_SOON_DAYS * 24 * 60 * 60 * 1000);

  // Migrate legacy records that have no dueDate — default to createdAt + 3 days
  await Credit.updateMany(
    { isDeleted: false, dueDate: { $exists: false } },
    [{ $set: { dueDate: { $add: ["$createdAt", 3 * 24 * 60 * 60 * 1000] } } }]
  );

  await Promise.all([
    // Overdue: dueDate is in the past
    Credit.updateMany(
      { isDeleted: false, balance: { $gt: 0 }, dueDate: { $lt: todayStart }, status: { $nin: ["overdue", "paid"] } },
      { $set: { status: "overdue" } }
    ),
    // Due soon: dueDate is today or within 3 days
    Credit.updateMany(
      { isDeleted: false, balance: { $gt: 0 }, dueDate: { $gte: todayStart, $lte: threeDaysFromNow }, status: { $nin: ["due_soon", "paid"] } },
      { $set: { status: "due_soon" } }
    ),
    // Pending: dueDate is more than 3 days away (also migrates old "active" records)
    Credit.updateMany(
      { isDeleted: false, balance: { $gt: 0 }, dueDate: { $gt: threeDaysFromNow }, status: { $in: ["due_soon", "active"] } },
      { $set: { status: "pending" } }
    ),
  ]);
}

export const creditsService = {
  refreshStatuses,

  async create(userId: string, data: Partial<ICredit>) {
    const credit = new Credit({
      userId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      description: data.description,
      amount: data.amount,
      amountPaid: 0,
      balance: data.amount,
      dueDate: data.dueDate,
      localId: data.localId,
    });
    await credit.save();
    return credit;
  },

  async list(userId: string, query: { status?: string; page?: number; limit?: number }) {
    await refreshStatuses();
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const filter: Record<string, unknown> = { userId, isDeleted: false };
    if (query.status && query.status !== "all") filter.status = query.status;

    const [credits, total] = await Promise.all([
      Credit.find(filter).sort({ dueDate: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Credit.countDocuments(filter),
    ]);
    return { credits, total, page, limit };
  },

  async getById(userId: string, id: string) {
    const credit = await Credit.findOne({ _id: id, userId, isDeleted: false });
    if (!credit) throw new AppError(404, "Credit not found", "NOT_FOUND");
    return credit;
  },

  async recordPayment(userId: string, id: string, amount: number, note?: string) {
    const credit = await Credit.findOne({ _id: id, userId, isDeleted: false });
    if (!credit) throw new AppError(404, "Credit not found", "NOT_FOUND");
    if (credit.status === "paid") throw new AppError(400, "Credit already fully paid", "ALREADY_PAID");

    const paying = Math.min(amount, credit.balance);
    credit.amountPaid += paying;
    credit.payments.push({ amount: paying, date: new Date(), note });
    await credit.save(); // pre-save hook updates balance + status
    return credit;
  },

  async updatePhone(userId: string, id: string, phone: string) {
    const credit = await Credit.findOneAndUpdate(
      { _id: id, userId, isDeleted: false },
      { customerPhone: phone },
      { new: true }
    );
    if (!credit) throw new AppError(404, "Credit not found", "NOT_FOUND");
    return credit;
  },

  async delete(userId: string, id: string) {
    const credit = await Credit.findOne({ _id: id, userId, isDeleted: false });
    if (!credit) throw new AppError(404, "Credit not found", "NOT_FOUND");
    credit.isDeleted = true;
    await credit.save();
  },

  async getStats(userId: string) {
    await refreshStatuses();
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const credits = await Credit.find({ userId, isDeleted: false });

    let totalOutstanding = 0;
    let totalOriginal = 0;
    let overdueAmount = 0;
    let overdueCount = 0;
    let dueSoonAmount = 0;
    let dueSoonCount = 0;
    let collectedThisWeek = 0;

    for (const c of credits) {
      totalOriginal += c.amount;
      if (c.status !== "paid") {
        totalOutstanding += c.balance;
        if (c.status === "overdue") { overdueAmount += c.balance; overdueCount++; }
        if (c.status === "due_soon") { dueSoonAmount += c.balance; dueSoonCount++; }
      }
      for (const p of c.payments) {
        if (p.date >= weekStart) collectedThisWeek += p.amount;
      }
    }

    const percentCollected = totalOriginal > 0
      ? Math.round(((totalOriginal - totalOutstanding) / totalOriginal) * 100)
      : 0;

    return {
      totalOutstanding,
      totalOriginal,
      percentCollected,
      overdueAmount,
      overdueCount,
      dueSoonAmount,
      dueSoonCount,
      collectedThisWeek,
    };
  },
};

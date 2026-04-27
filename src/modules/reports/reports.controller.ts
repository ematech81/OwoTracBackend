import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { summaryService } from "./summary.service";
import { sendSuccess } from "../../utils/response";
import { User } from "../users/user.model";
import { Sale } from "../sales/sale.model";
import { Expense } from "../expenses/expense.model";
import { Credit } from "../credits/credit.model";
import { StockItem } from "../stock/stock.model";
import { getPlan } from "../../config/plans";
import { AppError } from "../../middleware/errorHandler";

export const reportsController = {
  async daily(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
      const summary = await summaryService.getDaily(req.userId!, date);
      sendSuccess(res, summary);
    } catch (err) { next(err); }
  },

  async weekly(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
      const summary = await summaryService.getWeekly(req.userId!, date);
      sendSuccess(res, summary);
    } catch (err) { next(err); }
  },

  async monthly(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const year = parseInt(req.query.year as string) || now.getFullYear();
      const month = parseInt(req.query.month as string) || now.getMonth() + 1;
      const summary = await summaryService.getMonthly(req.userId!, year, month);
      sendSuccess(res, summary);
    } catch (err) { next(err); }
  },

  async export(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await User.findById(req.userId).select("subscription businessName name");
      if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");

      const plan = getPlan(user.subscription.plan);
      if (!plan.limits.canExport) {
        throw new AppError(403, "Data export is not available on your current plan. Upgrade to Business.", "PLAN_LIMIT_REACHED");
      }

      const now = new Date();
      const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1); // start of current month

      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : defaultStart;
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : now;

      // Clamp end to end-of-day
      endDate.setHours(23, 59, 59, 999);

      const [sales, expenses, credits, stock] = await Promise.all([
        Sale.find({
          userId: req.userId,
          isDeleted: false,
          date: { $gte: startDate, $lte: endDate },
        }).sort({ date: -1 }).lean(),

        Expense.find({
          userId: req.userId,
          isDeleted: false,
          date: { $gte: startDate, $lte: endDate },
        }).sort({ date: -1 }).lean(),

        Credit.find({
          userId: req.userId,
          isDeleted: false,
          status: { $ne: "paid" },
        }).sort({ dueDate: 1 }).lean(),

        StockItem.find({
          userId: req.userId,
          isDeleted: false,
        }).sort({ name: 1 }).lean(),
      ]);

      const totalRevenue = sales.reduce((s, x) => s + x.totalAmount, 0);
      const totalCOGS = sales.reduce((s, x) => s + x.totalCostOfGoods, 0);
      const totalProfit = sales.reduce((s, x) => s + x.totalProfit, 0);
      const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0);
      const netProfit = totalProfit - totalExpenses;
      const totalOutstanding = credits.reduce((s, x) => s + x.balance, 0);
      const stockValue = stock.reduce((s, x) => s + x.sellingPrice * x.qty, 0);

      sendSuccess(res, {
        meta: {
          businessName: user.businessName || user.name,
          exportedAt: now.toISOString(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        summary: {
          totalRevenue,
          totalCOGS,
          totalProfit,
          totalExpenses,
          netProfit,
          profitMargin: totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0,
          salesCount: sales.length,
          totalOutstandingCredits: totalOutstanding,
          stockValue,
        },
        sales: sales.map((s) => ({
          date: s.date,
          items: s.items.map((i) => ({ name: i.productName, qty: i.quantity, price: i.unitPrice, total: i.totalAmount })),
          total: s.totalAmount,
          profit: s.totalProfit,
          payment: s.paymentType,
        })),
        expenses: expenses.map((e) => ({
          date: e.date,
          description: e.description,
          category: e.category,
          amount: e.amount,
        })),
        credits: credits.map((c) => ({
          customer: c.customerName,
          description: c.description,
          original: c.amount,
          balance: c.balance,
          dueDate: c.dueDate,
          status: c.status,
        })),
        stock: stock.map((s) => ({
          name: s.name,
          category: s.category,
          quantity: s.qty,
          sellingPrice: s.sellingPrice,
          costPrice: s.costPrice,
          value: s.sellingPrice * s.qty,
        })),
      });
    } catch (err) { next(err); }
  },
};

import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { User } from "../modules/users/user.model";
import { getPlan, isUnlimited, PlanLimits } from "../config/plans";
import { AppError } from "./errorHandler";
import { startOfMonth } from "../utils/dateUtils";

type LimitKey = keyof Pick<
  PlanLimits,
  "salesPerMonth" | "expensesPerMonth" | "activeCredits" | "stockItems" | "aiChatsPerDay" | "voicePerMonth"
>;

export function planGate(limitKey: LimitKey, getCurrentCount: (userId: string) => Promise<number>) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      const user = await User.findById(req.userId).select("subscription");
      if (!user) return next(new AppError(401, "User not found", "UNAUTHORIZED"));

      const plan = getPlan(user.subscription.plan);
      const limit = plan.limits[limitKey] as number;

      if (isUnlimited(limit)) return next();

      const count = await getCurrentCount(req.userId!);
      if (count >= limit) {
        return next(
          new AppError(
            403,
            `You have reached your ${plan.name} plan limit for this feature. Upgrade to continue.`,
            "PLAN_LIMIT_REACHED"
          )
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

// Pre-built guards for each route
import { Sale } from "../modules/sales/sale.model";
import { Expense } from "../modules/expenses/expense.model";
import { Credit } from "../modules/credits/credit.model";
import { StockItem } from "../modules/stock/stock.model";

export const guardSales = planGate("salesPerMonth", async (userId) => {
  const from = startOfMonth(new Date());
  return Sale.countDocuments({ userId, isDeleted: false, date: { $gte: from } });
});

export const guardExpenses = planGate("expensesPerMonth", async (userId) => {
  const from = startOfMonth(new Date());
  return Expense.countDocuments({ userId, isDeleted: false, date: { $gte: from } });
});

export const guardCredits = planGate("activeCredits", async (userId) => {
  return Credit.countDocuments({ userId, isDeleted: false, status: { $in: ["outstanding", "partially_paid", "overdue"] } });
});

export const guardStock = planGate("stockItems", async (userId) => {
  return StockItem.countDocuments({ userId, isDeleted: false });
});

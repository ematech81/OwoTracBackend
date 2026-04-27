import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { User } from "./user.model";
import { Sale } from "../sales/sale.model";
import { Credit } from "../credits/credit.model";
import { Expense } from "../expenses/expense.model";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/response";

export const usersController = {
  async getMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await User.findById(req.userId).select("-pin -refreshToken");
      if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");
      sendSuccess(res, user);
    } catch (err) {
      next(err);
    }
  },

  async updateMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, businessName, businessType, location, preferredLanguage, currency } = req.body;
      const update: Record<string, unknown> = {};

      if (name) update.name = name;
      if (businessName !== undefined) update.businessName = businessName;
      if (businessType) update.businessType = businessType;
      if (preferredLanguage) update.preferredLanguage = preferredLanguage;
      if (currency) update.currency = currency;
      if (location) {
        if (location.state !== undefined) update["location.state"] = location.state;
        if (location.city !== undefined) update["location.city"] = location.city;
        if (location.market !== undefined) update["location.market"] = location.market;
      }

      const user = await User.findByIdAndUpdate(
        req.userId,
        { $set: update },
        { new: true, runValidators: true }
      ).select("-pin -refreshToken");

      if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");
      sendSuccess(res, user, "Profile updated");
    } catch (err) {
      next(err);
    }
  },

  async updateNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { dailyReminder, dailyReminderTime, weeklyReport, creditReminders } = req.body;
      const update: Record<string, unknown> = {};

      if (dailyReminder !== undefined) update["notifications.dailyReminder"] = dailyReminder;
      if (dailyReminderTime) update["notifications.dailyReminderTime"] = dailyReminderTime;
      if (weeklyReport !== undefined) update["notifications.weeklyReport"] = weeklyReport;
      if (creditReminders !== undefined) update["notifications.creditReminders"] = creditReminders;

      const user = await User.findByIdAndUpdate(
        req.userId,
        { $set: update },
        { new: true }
      ).select("notifications");

      sendSuccess(res, user?.notifications, "Notification settings updated");
    } catch (err) {
      next(err);
    }
  },

  async updatePushToken(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await User.findByIdAndUpdate(req.userId, {
        $set: { "notifications.pushToken": req.body.pushToken },
      });
      sendSuccess(res, null, "Push token registered");
    } catch (err) {
      next(err);
    }
  },

  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const user = await User.findById(userId).select(
        "streakDays healthScore loanEligible createdAt subscription"
      );
      if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const accountAgeMs = Date.now() - new Date(user.createdAt).getTime();
      const accountAgeDays = Math.floor(accountAgeMs / (24 * 60 * 60 * 1000));

      const [sales30, salesAll, expenses30, credits] = await Promise.all([
        Sale.find({ userId, isDeleted: false, date: { $gte: thirtyDaysAgo } }).lean(),
        Sale.find({ userId, isDeleted: false }).lean(),
        Expense.find({ userId, isDeleted: false, date: { $gte: thirtyDaysAgo } }).lean(),
        Credit.find({ userId, isDeleted: false }).lean(),
      ]);

      // ── All-time totals ──────────────────────────────────────────────────────
      const totalSalesAllTime = salesAll.reduce((s, x) => s + x.totalAmount, 0);
      const totalProfitAllTime = salesAll.reduce((s, x) => s + x.totalProfit, 0);
      const salesDaysAll = new Set(salesAll.map((s) => new Date(s.date).toISOString().slice(0, 10)));
      const totalDaysActive = salesDaysAll.size;

      // ── Health Score (0–100) ─────────────────────────────────────────────────
      //
      // 1. Sales consistency (25 pts): how many of the last 30 days had a sale
      const salesDays30 = new Set(sales30.map((s) => new Date(s.date).toISOString().slice(0, 10)));
      const consistencyScore = Math.round((salesDays30.size / 30) * 25);

      // 2. Profit margin (25 pts): avg profit margin over 30 days, full score at ≥30%
      const avgMargin = sales30.length > 0
        ? sales30.reduce((s, x) => s + x.profitMargin, 0) / sales30.length
        : 0;
      const profitScore = Math.min(25, Math.round((avgMargin / 30) * 25));

      // 3. Expense control (20 pts): profit ratio — how much of revenue becomes profit
      const revenue30 = sales30.reduce((s, x) => s + x.totalAmount, 0);
      const profit30  = sales30.reduce((s, x) => s + x.totalProfit, 0);
      const profitRatio = revenue30 > 0 ? profit30 / revenue30 : 0;
      const expenseScore = Math.min(20, Math.round(profitRatio * 20));

      // 4. Credit health (15 pts): overdue credits are a negative signal
      const activeCredits = credits.filter((c) => c.status !== "paid");
      const overdueCredits = credits.filter((c) => c.status === "overdue");
      const creditRatio = activeCredits.length > 0
        ? 1 - overdueCredits.length / activeCredits.length
        : 1;
      const creditScore = Math.round(creditRatio * 15);

      // 5. Streak bonus (15 pts): 1 pt per streak day, capped at 15
      const streakScore = Math.min(15, user.streakDays);

      const healthScore = consistencyScore + profitScore + expenseScore + creditScore + streakScore;

      // ── Loan Eligibility ─────────────────────────────────────────────────────
      // Internally scored — no third-party integration yet.
      // Criteria: health ≥ 60, streak ≥ 5, account ≥ 30 days old, ≥ 10 sales in last 30 days.
      const loanEligible =
        healthScore >= 60 &&
        user.streakDays >= 5 &&
        accountAgeDays >= 30 &&
        sales30.length >= 10;

      // Persist updated values so profile reads are cheap
      await User.findByIdAndUpdate(userId, { healthScore, loanEligible });

      sendSuccess(res, {
        totalSalesAllTime,
        totalProfitAllTime,
        totalDaysActive,
        streakDays: user.streakDays,
        healthScore,
        loanEligible,
        memberSince: user.createdAt,
        accountAgeDays,
        // breakdown for transparency
        scoreBreakdown: {
          salesConsistency: consistencyScore,   // max 25
          profitMargin: profitScore,             // max 25
          expenseControl: expenseScore,          // max 20
          creditHealth: creditScore,             // max 15
          streakBonus: streakScore,              // max 15
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async getReferral(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await User.findById(req.userId).select("referralCode name");
      if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");

      // Fetch people who used this user's code (limited to 20 most recent)
      const referrals = await User.find({ referredBy: req.userId })
        .select("name createdAt subscription")
        .sort({ createdAt: -1 })
        .limit(20);

      const referralList = referrals.map((r) => ({
        firstName: r.name.trim().split(" ")[0],
        joinedAt: r.createdAt,
        isActive: r.subscription?.status === "active",
        plan: r.subscription?.plan ?? "free",
      }));

      sendSuccess(res, {
        referralCode: user.referralCode,
        referralLink: `https://owotrack.com/join?ref=${user.referralCode}`,
        totalReferrals: referrals.length,
        referrals: referralList,
      });
    } catch (err) {
      next(err);
    }
  },
};

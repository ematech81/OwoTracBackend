import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { User } from "./user.model";
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
      const user = await User.findById(req.userId).select(
        "streakDays healthScore loanEligible createdAt"
      );
      if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");

      sendSuccess(res, {
        totalSalesAllTime: 0,
        totalProfitAllTime: 0,
        totalDaysActive: 0,
        streakDays: user.streakDays,
        healthScore: user.healthScore,
        loanEligible: user.loanEligible,
        memberSince: user.createdAt,
      });
    } catch (err) {
      next(err);
    }
  },

  async getReferral(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await User.findById(req.userId).select("referralCode name");
      if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");

      const referralCount = await User.countDocuments({ referredBy: req.userId });

      sendSuccess(res, {
        referralCode: user.referralCode,
        referralLink: `https://owotrack.com/join?ref=${user.referralCode}`,
        totalReferrals: referralCount,
      });
    } catch (err) {
      next(err);
    }
  },
};

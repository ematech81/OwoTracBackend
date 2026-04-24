import cron from "node-cron";
import { Credit } from "../modules/credits/credit.model";
import { User } from "../modules/users/user.model";
import { notificationService } from "../modules/notifications/notification.service";
import { logger } from "../config/logger";

// Runs daily at 9 AM Nigeria time (UTC+1 → 08:00 UTC)
export function startCreditOverdueJob() {
  cron.schedule("0 8 * * *", async () => {
    logger.info("Running credit overdue reminder job");
    try {
      // Group overdue + due_soon credits by user
      const overdueSummary = await Credit.aggregate<{ _id: string; count: number }>([
        { $match: { status: { $in: ["overdue", "due_soon"] }, isDeleted: false } },
        { $group: { _id: "$userId", count: { $sum: 1 } } },
      ]);

      const messages = await Promise.all(
        overdueSummary.map(async ({ _id: userId, count }) => {
          const user = await User.findById(userId).lean();
          if (!user?.notifications?.pushToken || user.notifications.creditReminders === false) return null;
          return {
            token: user.notifications.pushToken,
            title: "Credit Reminder 💰",
            body: count === 1
              ? "You get 1 customer debt wey need follow-up today."
              : `You get ${count} customer debts wey need follow-up today.`,
            data: { type: "credit_reminder" },
          };
        })
      );

      const valid = messages.filter(Boolean) as NonNullable<(typeof messages)[number]>[];
      await notificationService.sendMany(valid);
      logger.info(`Credit reminders sent to ${valid.length} user(s)`);
    } catch (err) {
      logger.error("Credit overdue job failed:", err);
    }
  }, { timezone: "Africa/Lagos" });

  logger.info("Credit overdue job scheduled (09:00 WAT daily)");
}

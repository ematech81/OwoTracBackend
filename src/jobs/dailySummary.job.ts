import cron from "node-cron";
import { User } from "../modules/users/user.model";
import { summaryService } from "../modules/reports/summary.service";
import { notificationService } from "../modules/notifications/notification.service";
import { logger } from "../config/logger";

const todayStr = () => new Date().toISOString().split("T")[0];

// Runs daily at 7 PM Nigeria time (UTC+1 → 18:00 UTC)
export function startDailySummaryJob() {
  cron.schedule("0 18 * * *", async () => {
    logger.info("Running daily summary notification job");
    try {
      const users = await User.find({
        "notifications.pushToken": { $exists: true, $ne: "" },
        "notifications.dailyReminder": { $ne: false },
        isActive: true,
      }).lean();

      const today = todayStr();
      const messages: { token: string; title: string; body: string; data?: Record<string, unknown> }[] = [];

      await Promise.all(
        users.map(async (user) => {
          try {
            const summary = await summaryService.getDaily(user._id.toString(), today);
            if (!summary || summary.totalSales === 0) return; // no activity today — skip
            const fmt = (n: number) => `₦${n.toLocaleString("en-NG")}`;
            const profitEmoji = summary.netProfit >= 0 ? "📈" : "📉";
            messages.push({
              token: user.notifications.pushToken!,
              title: `Today's Summary ${profitEmoji}`,
              body: `Sales: ${fmt(summary.totalSales)} · Profit: ${fmt(summary.netProfit)}`,
              data: { type: "daily_summary" },
            });
          } catch { /* skip this user on error */ }
        })
      );

      await notificationService.sendMany(messages);
      logger.info(`Daily summaries sent to ${messages.length} user(s)`);
    } catch (err) {
      logger.error("Daily summary job failed:", err);
    }
  }, { timezone: "Africa/Lagos" });

  logger.info("Daily summary job scheduled (19:00 WAT daily)");
}

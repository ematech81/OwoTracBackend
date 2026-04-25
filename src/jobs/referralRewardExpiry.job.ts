import cron from "node-cron";
import { User } from "../modules/users/user.model";
import { notificationService } from "../modules/notifications/notification.service";
import { logger } from "../config/logger";

// Runs daily at 01:00 WAT — reverts expired referral-reward Growth plans to free.
// Only touches users whose Growth plan came from the referral reward (no Paystack sub code).
// Paid Growth subscribers are never affected.
export function startReferralRewardExpiryJob() {
  cron.schedule("0 0 * * *", async () => {
    logger.info("Running referral reward expiry job");
    try {
      const now = new Date();

      const expired = await User.find({
        hasUsedReferralReward: true,
        referralRewardExpiresAt: { $lt: now },
        "subscription.plan": "growth",
        "subscription.status": "active",
        // Only revert if there is no Paystack subscription — meaning they never paid
        "subscription.paystackSubscriptionCode": { $in: [null, undefined, ""] },
      }).select("_id name notifications");

      for (const user of expired) {
        await User.findByIdAndUpdate(user._id, {
          "subscription.plan": "free",
          "subscription.status": "inactive",
          $unset: {
            "subscription.startDate": "",
            "subscription.expiresAt": "",
          },
        });

        const token = user.notifications?.pushToken;
        if (token) {
          notificationService.send(
            token,
            "Your free Growth plan has ended",
            "Your referral reward has expired. Upgrade to continue enjoying Growth features!",
            { type: "referral_reward_expired" }
          ).catch(() => {});
        }
      }

      if (expired.length > 0) {
        logger.info(`Reverted ${expired.length} expired referral reward plan(s) to free`);
      }
    } catch (err) {
      logger.error("Referral reward expiry job failed:", err);
    }
  }, { timezone: "Africa/Lagos" });

  logger.info("Referral reward expiry job scheduled (01:00 WAT daily)");
}

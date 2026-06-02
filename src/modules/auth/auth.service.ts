import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../users/user.model";
import { AppError } from "../../middleware/errorHandler";
import { generateOtp, storeOtp, verifyOtp as verifyOtpLocal } from "../../utils/otp";
import { sendChampSendOtp, sendChampVerifyOtp } from "../../utils/sendchamp";
import { bulkSmsSendOtp, generateAlphanumericOtp, formatNigerianNumber } from "../../utils/bulkSmsService";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt";
import { generateReferralCode } from "../../utils/referral";
import { notificationService } from "../notifications/notification.service";
import { redis } from "../../config/redis";
import { adminNotify } from "../../utils/adminNotify";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

const TEMP_TOKEN_PREFIX = "temptoken:";
const TEMP_TOKEN_EXPIRES = 10 * 60; // 10 minutes

// ── Google Play review bypass ─────────────────────────────────────────────────
// Activates ONLY when both TEST_REVIEW_PHONE and TEST_REVIEW_OTP are set in env.
// Remove both env vars to disable completely — no code change needed.
function isReviewAccount(phone: string): boolean {
  const { TEST_REVIEW_PHONE, TEST_REVIEW_OTP } = env;
  if (!TEST_REVIEW_PHONE || !TEST_REVIEW_OTP) return false;
  try {
    return formatNigerianNumber(phone) === formatNigerianNumber(TEST_REVIEW_PHONE);
  } catch {
    return false;
  }
}

export const authService = {
  async sendOtp(phone: string) {
    const existingUser = await User.exists({ phone });

    // ── Review bypass: skip SMS entirely, reviewer uses fixed OTP ──
    if (isReviewAccount(phone)) {
      logger.warn("[TEST BYPASS] Review account OTP send — SMS skipped");
      return { isNewUser: !existingUser };
    }

    if (env.SENDCHAMP_MODE !== "production") {
      // ── Test mode: generate locally, log to console, return devOtp for app auto-fill ──
      const otp = generateOtp();
      await storeOtp(phone, otp);
      logger.info(`[SENDCHAMP TEST MODE] OTP for ${phone}: ${otp} (expires in ${env.SENDCHAMP_OTP_EXPIRY_MINUTES} min)`);
      return { isNewUser: !existingUser, devOtp: otp };
    }

    // ── Production mode: send via selected SMS provider ──
    if (env.SMS_PROVIDER === "bulksms") {
      // BulkSMS: alphanumeric OTP generated locally, stored in Redis, delivered via BulkSMS
      const otp = generateAlphanumericOtp();
      await storeOtp(phone, otp);
      await bulkSmsSendOtp(phone, otp);
    } else {
      // SendChamp: SendChamp generates + sends OTP, we store the reference
      await sendChampSendOtp(phone, phone);
    }
    return { isNewUser: !existingUser };
  },

  async verifyOtp(phone: string, otp: string) {
    // ── Review bypass: check fixed OTP, skip all real verification ──
    if (isReviewAccount(phone)) {
      if (otp !== env.TEST_REVIEW_OTP) {
        throw new AppError(400, "Invalid or expired OTP", "OTP_INVALID");
      }
      logger.warn("[TEST BYPASS] Review account OTP verified — real check skipped");
    } else {
      // BulkSMS and test mode both verify locally from Redis; SendChamp uses its API
      const valid = env.SENDCHAMP_MODE !== "production" || env.SMS_PROVIDER === "bulksms"
        ? await verifyOtpLocal(phone, otp)
        : await sendChampVerifyOtp(phone, otp);
      if (!valid) throw new AppError(400, "Invalid or expired OTP", "OTP_INVALID");
    }

    const isNewUser = !(await User.exists({ phone }));

    const tempToken = jwt.sign({ phone, verified: true }, env.JWT_ACCESS_SECRET, {
      expiresIn: "10m",
    });

    await redis.setex(`${TEMP_TOKEN_PREFIX}${phone}`, TEMP_TOKEN_EXPIRES, tempToken);

    return { isNewUser, tempToken };
  },

  async register(data: {
    tempToken: string;
    name: string;
    phone: string;
    businessName?: string;
    businessType?: string;
    location?: { state?: string; city?: string; market?: string };
    preferredLanguage: "pidgin" | "english";
    pin: string;
    referralCode?: string;
  }) {
    const payload = jwt.verify(data.tempToken, env.JWT_ACCESS_SECRET) as {
      phone: string;
      verified: boolean;
    };

    if (payload.phone !== data.phone || !payload.verified) {
      throw new AppError(400, "Invalid verification token", "INVALID_TEMP_TOKEN");
    }

    const stored = await redis.get(`${TEMP_TOKEN_PREFIX}${data.phone}`);
    if (!stored || stored !== data.tempToken) {
      throw new AppError(400, "Verification token expired. Please verify OTP again.", "TEMP_TOKEN_EXPIRED");
    }

    const existing = await User.findOne({ phone: data.phone });
    if (existing) throw new AppError(409, "Account already exists", "PHONE_EXISTS");

    const hashedPin = await bcrypt.hash(data.pin, env.BCRYPT_SALT_ROUNDS);
    const referralCode = await generateReferralCode();

    let referredBy;
    let referrerPushToken: string | undefined;
    let referrerName: string | undefined;
    if (data.referralCode) {
      const referrer = await User.findOne({ referralCode: data.referralCode })
        .select("_id name notifications");
      if (referrer) {
        referredBy = referrer._id;
        referrerPushToken = referrer.notifications?.pushToken;
        referrerName = referrer.name;
      }
    }

    const user = await User.create({
      name: data.name,
      phone: data.phone,
      businessName: data.businessName,
      businessType: data.businessType,
      location: { country: "Nigeria", ...data.location },
      preferredLanguage: data.preferredLanguage,
      pin: hashedPin,
      isPhoneVerified: true,
      referralCode,
      referredBy,
    });

    await redis.del(`${TEMP_TOKEN_PREFIX}${data.phone}`);

    adminNotify("NEW_USER", `${user.name} (${user.phone}) just registered`, {
      userId: user._id.toString(),
      name: user.name,
      phone: user.phone,
    }).catch(() => {});

    // Notify the referrer and check for referral reward
    if (referredBy) {
      const newUserFirstName = data.name.trim().split(" ")[0];

      if (referrerPushToken) {
        notificationService.send(
          referrerPushToken,
          "🎉 Someone joined using your code!",
          `${newUserFirstName} just signed up to OwoTrack with your referral code. Keep sharing!`,
          { type: "referral_signup", referredUserId: user._id.toString() }
        ).catch(() => {});
      }

      // Check referral reward: grant one-time 30-day Growth plan at 10 referrals
      const referrer = await User.findById(referredBy).select(
        "hasUsedReferralReward subscription notifications"
      );
      if (referrer && !referrer.hasUsedReferralReward) {
        const referralCount = await User.countDocuments({ referredBy });
        if (referralCount >= 10) {
          const now = new Date();
          const rewardExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          await User.findByIdAndUpdate(referredBy, {
            "subscription.plan": "growth",
            "subscription.status": "active",
            "subscription.startDate": now,
            "subscription.expiresAt": rewardExpiresAt,
            hasUsedReferralReward: true,
            referralRewardExpiresAt: rewardExpiresAt,
          });
          const rewardToken = referrer.notifications?.pushToken;
          if (rewardToken) {
            notificationService.send(
              rewardToken,
              "🏆 You've unlocked a free Growth plan!",
              "You referred 10 users! Enjoy 30 days of Growth plan — free. Thank you for growing OwoTrack!",
              { type: "referral_reward" }
            ).catch(() => {});
          }
        }
      }
    }

    const accessToken = signAccessToken(user._id.toString());
    const refreshToken = signRefreshToken(user._id.toString());
    await User.findByIdAndUpdate(user._id, { refreshToken });

    return {
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
    };
  },

  async login(phone: string, pin: string) {
    const user = await User.findOne({ phone, isActive: true });
    if (!user) throw new AppError(401, "Phone number not registered", "USER_NOT_FOUND");

    const pinValid = await bcrypt.compare(pin, user.pin);
    if (!pinValid) throw new AppError(401, "Incorrect PIN", "INVALID_PIN");

    const accessToken = signAccessToken(user._id.toString());
    const refreshToken = signRefreshToken(user._id.toString());
    await User.findByIdAndUpdate(user._id, { refreshToken });

    return { accessToken, refreshToken, user: sanitizeUser(user) };
  },

  async refreshToken(token: string) {
    let payload: { userId: string };
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw new AppError(401, "Invalid or expired refresh token", "REFRESH_TOKEN_INVALID");
    }

    const user = await User.findById(payload.userId);
    if (!user || user.refreshToken !== token) {
      throw new AppError(401, "Refresh token revoked", "REFRESH_TOKEN_REVOKED");
    }

    const accessToken = signAccessToken(user._id.toString());
    const refreshToken = signRefreshToken(user._id.toString());
    await User.findByIdAndUpdate(user._id, { refreshToken });

    return { accessToken, refreshToken };
  },

  async logout(refreshToken?: string) {
    if (refreshToken) {
      // Best-effort: clear the refresh token so it can't be reused
      await User.findOneAndUpdate({ refreshToken }, { $unset: { refreshToken: 1 } });
    }
    // Always succeeds — local token clearance on the client is enough
  },

  async changePin(userId: string, currentPin: string, newPin: string) {
    const user = await User.findById(userId);
    if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");

    const valid = await bcrypt.compare(currentPin, user.pin);
    if (!valid) throw new AppError(400, "Incorrect current PIN", "INVALID_PIN");

    const hashedPin = await bcrypt.hash(newPin, env.BCRYPT_SALT_ROUNDS);
    await User.findByIdAndUpdate(userId, { pin: hashedPin });
  },

  async forgotPin(phone: string) {
    const user = await User.exists({ phone });
    if (!user) throw new AppError(404, "Phone number not registered", "USER_NOT_FOUND");

    if (env.SENDCHAMP_MODE !== "production") {
      // ── Test mode ──
      const otp = generateOtp();
      await storeOtp(`resetpin:${phone}`, otp);
      logger.info(`[SENDCHAMP TEST MODE] PIN reset OTP for ${phone}: ${otp} (expires in ${env.SENDCHAMP_OTP_EXPIRY_MINUTES} min)`);
      return { devOtp: otp };
    }

    // ── Production mode ──
    if (env.SMS_PROVIDER === "bulksms") {
      const otp = generateAlphanumericOtp();
      await storeOtp(`resetpin:${phone}`, otp);
      await bulkSmsSendOtp(phone, otp);
    } else {
      await sendChampSendOtp(phone, `resetpin:${phone}`);
    }
    return {};
  },

  async resetPin(phone: string, otp: string, newPin: string) {
    const valid = env.SENDCHAMP_MODE !== "production" || env.SMS_PROVIDER === "bulksms"
      ? await verifyOtpLocal(`resetpin:${phone}`, otp)
      : await sendChampVerifyOtp(`resetpin:${phone}`, otp);   // production SendChamp: API verify
    if (!valid) throw new AppError(400, "Invalid or expired OTP", "OTP_INVALID");

    const hashedPin = await bcrypt.hash(newPin, env.BCRYPT_SALT_ROUNDS);
    await User.findOneAndUpdate({ phone }, { pin: hashedPin });
  },
};

const sanitizeUser = (user: InstanceType<typeof User>) => ({
  _id: user._id,
  name: user.name,
  phone: user.phone,
  email: user.email,
  businessName: user.businessName,
  businessType: user.businessType,
  location: user.location,
  preferredLanguage: user.preferredLanguage,
  currency: user.currency,
  subscription: user.subscription,
  healthScore: user.healthScore,
  loanEligible: user.loanEligible,
  referralCode: user.referralCode,
  hasUsedReferralReward: user.hasUsedReferralReward,
  referralRewardExpiresAt: user.referralRewardExpiresAt,
  streakDays: user.streakDays,
  isPhoneVerified: user.isPhoneVerified,
  notifications: {
    dailyReminder: user.notifications.dailyReminder,
    dailyReminderTime: user.notifications.dailyReminderTime,
    weeklyReport: user.notifications.weeklyReport,
    creditReminders: user.notifications.creditReminders,
  },
  createdAt: user.createdAt,
});

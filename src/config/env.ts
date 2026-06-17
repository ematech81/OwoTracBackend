import dotenv from "dotenv";
dotenv.config();

console.log("ENV CHECK:", {
  MONGODB_URI: process.env.MONGODB_URI ? "SET" : "MISSING",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ? "SET" : "MISSING",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ? "SET" : "MISSING",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "SET" : "MISSING",
  NODE_ENV: process.env.NODE_ENV,
});

const required = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
};

const requiredInProd = (key: string): string => {
  const val = process.env[key] || "";
  if (!val && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required env var in production: ${key}`);
  }
  return val;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "5000", 10),
  APP_NAME: process.env.APP_NAME || "OwoTrack",

  MONGODB_URI: required("MONGODB_URI"),
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",

  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET"),
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || "15m",
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || "30d",

  OPENAI_API_KEY: required("OPENAI_API_KEY"),
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4o",
  OPENAI_WHISPER_MODEL: process.env.OPENAI_WHISPER_MODEL || "whisper-1",
  OPENAI_MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS || "1500", 10),
  OPENAI_TEMPERATURE: parseFloat(process.env.OPENAI_TEMPERATURE || "0.7"),

  GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID || "",
  GOOGLE_CLOUD_KEY_FILE: process.env.GOOGLE_CLOUD_KEY_FILE || "./google-credentials.json",

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",

  // DEPRECATED: Replaced by Korapay (2026-05-16). Keep for rollback until 2026-06-16.
  // FLW_SECRET_KEY: requiredInProd("FLW_SECRET_KEY"),
  // FLW_WEBHOOK_HASH: requiredInProd("FLW_WEBHOOK_HASH"),
  FLW_SECRET_KEY: process.env.FLW_SECRET_KEY || "",
  FLW_WEBHOOK_HASH: process.env.FLW_WEBHOOK_HASH || "",

  // ── Korapay payments ──────────────────────────────────────────────────────
  KORAPAY_MODE: process.env.KORAPAY_MODE === "production" ? "production" : "test",
  KORAPAY_BASE_URL: process.env.KORAPAY_BASE_URL || "https://api.korapay.com/merchant/api/v1",
  KORAPAY_PUBLIC_KEY: process.env.KORAPAY_PUBLIC_KEY || "",
  KORAPAY_SECRET_KEY: process.env.KORAPAY_SECRET_KEY || "",
  KORAPAY_WEBHOOK_SECRET: process.env.KORAPAY_WEBHOOK_SECRET || "",

  // Plan prices in Naira — set via env so prices change without redeploying code
  KORAPAY_PLAN_GROWTH_MONTHLY:   parseInt(process.env.KORAPAY_PLAN_GROWTH_MONTHLY   || "3000",  10),
  KORAPAY_PLAN_PRO_MONTHLY:      parseInt(process.env.KORAPAY_PLAN_PRO_MONTHLY      || "5000",  10),
  KORAPAY_PLAN_BUSINESS_MONTHLY: parseInt(process.env.KORAPAY_PLAN_BUSINESS_MONTHLY || "10000", 10),

  // ── Twilio (DEPRECATED — replaced by SendChamp 2026-05-16) ─────────────────
  // Keep until 1-week rollback window closes. Do not remove yet.
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || "",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || "",
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || "",
  FORCE_CONSOLE_OTP: process.env.FORCE_CONSOLE_OTP === "true", // DEPRECATED — use SENDCHAMP_MODE

  // ── SMS provider selector ─────────────────────────────────────────────────
  // Options: "sendchamp" | "bulksms"  — default sendchamp (existing behaviour)
  SMS_PROVIDER: (process.env.SMS_PROVIDER || "sendchamp") as "sendchamp" | "bulksms",

  // ── SendChamp OTP ─────────────────────────────────────────────────────────
  SENDCHAMP_BASE_URL: process.env.SENDCHAMP_BASE_URL || "https://api.sendchamp.com/api/v1",
  SENDCHAMP_PUBLIC_KEY: process.env.SENDCHAMP_PUBLIC_KEY || "",
  SENDCHAMP_SENDER_NAME: process.env.SENDCHAMP_SENDER_NAME || "Sendchamp",
  SENDCHAMP_MODE: process.env.SENDCHAMP_MODE === "production" ? "production" : "test",
  SENDCHAMP_OTP_EXPIRY_MINUTES: parseInt(process.env.SENDCHAMP_OTP_EXPIRY_MINUTES || "5", 10),
  SENDCHAMP_OTP_LENGTH: parseInt(process.env.SENDCHAMP_OTP_LENGTH || "6", 10),

  // ── BulkSMS Nigeria OTP ───────────────────────────────────────────────────
  BULKSMS_BASE_URL:   process.env.BULKSMS_BASE_URL   || "https://www.bulksmsnigeria.com/api/v2",
  BULKSMS_API_TOKEN:  process.env.BULKSMS_API_TOKEN  || "",
  BULKSMS_SENDER_ID:  process.env.BULKSMS_SENDER_ID  || "OwoTrack",

  // ── Brevo transactional email ─────────────────────────────────────────────
  BREVO_API_KEY: process.env.BREVO_API_KEY || "",
  BREVO_FROM_EMAIL: process.env.BREVO_FROM_EMAIL || "nwankwolivinus95@gmail.com",
  BREVO_FROM_NAME: process.env.BREVO_FROM_NAME || "OwoTrack",

  // DEPRECATED: Replaced by Brevo. Keep until Railway vars are cleaned up.
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || "",
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || "noreply@owotrack.com",
  SENDGRID_FROM_NAME: process.env.SENDGRID_FROM_NAME || "OwoTrack",

  APP_KEY: process.env.APP_KEY || "",

  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
  OTP_EXPIRES_MINUTES: parseInt(process.env.OTP_EXPIRES_MINUTES || "10", 10),

  SENTRY_DSN: process.env.SENTRY_DSN || "",

  // ── Google Play review bypass ─────────────────────────────────────────────
  // Bypass only activates when BOTH vars are set. Remove both to disable.
  TEST_REVIEW_PHONE: process.env.TEST_REVIEW_PHONE || "",
  TEST_REVIEW_OTP:   process.env.TEST_REVIEW_OTP   || "",
} as const;

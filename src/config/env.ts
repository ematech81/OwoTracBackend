import dotenv from "dotenv";
dotenv.config();

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

  PAYSTACK_SECRET_KEY: requiredInProd("PAYSTACK_SECRET_KEY"),
  PAYSTACK_PUBLIC_KEY: requiredInProd("PAYSTACK_PUBLIC_KEY"),
  PAYSTACK_WEBHOOK_SECRET: requiredInProd("PAYSTACK_WEBHOOK_SECRET"),
  PAYSTACK_PLAN_GROWTH: process.env.PAYSTACK_PLAN_GROWTH || "",
  PAYSTACK_PLAN_PRO: process.env.PAYSTACK_PLAN_PRO || "",
  PAYSTACK_PLAN_BUSINESS: process.env.PAYSTACK_PLAN_BUSINESS || "",

  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || "",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || "",
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || "",
  FORCE_CONSOLE_OTP: process.env.FORCE_CONSOLE_OTP === "true",

  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || "",
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || "noreply@owotrack.com",
  SENDGRID_FROM_NAME: process.env.SENDGRID_FROM_NAME || "OwoTrack",

  APP_KEY: process.env.APP_KEY || "",

  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
  OTP_EXPIRES_MINUTES: parseInt(process.env.OTP_EXPIRES_MINUTES || "10", 10),

  SENTRY_DSN: process.env.SENTRY_DSN || "",
} as const;

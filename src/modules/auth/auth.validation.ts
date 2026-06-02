import { z } from "zod";

const phoneSchema = z
  .string()
  .regex(/^\+?[0-9]{10,15}$/, "Invalid phone number");

const pinSchema = z
  .string()
  .length(4, "PIN must be exactly 4 digits")
  .regex(/^\d{4}$/, "PIN must contain only digits");

export const sendOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  // Accepts numeric (SendChamp) and alphanumeric (BulkSMS) 6-character codes
  otp: z.string().length(6, "OTP must be 6 characters").regex(/^[A-Za-z0-9]{6}$/),
});

export const registerSchema = z.object({
  tempToken: z.string().min(1),
  name: z.string().min(2, "Name must be at least 2 characters").trim(),
  phone: phoneSchema,
  businessName: z.string().trim().optional(),
  businessType: z
    .enum([
      "food_items", "fashion_clothing", "electronics",
      "provisions", "raw_materials", "pharmacy",
      "cosmetics", "agriculture", "services", "other",
    ])
    .optional(),
  location: z
    .object({
      state: z.string().optional(),
      city: z.string().optional(),
      market: z.string().optional(),
    })
    .optional(),
  preferredLanguage: z
    .enum(["pidgin", "english"])
    .default("pidgin"),
  pin: pinSchema,
  referralCode: z.string().optional(),
});

export const loginSchema = z.object({
  phone: phoneSchema,
  pin: pinSchema,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const changePinSchema = z.object({
  currentPin: pinSchema,
  newPin: pinSchema,
});

export const forgotPinSchema = z.object({
  phone: phoneSchema,
});

export const resetPinSchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6).regex(/^[A-Za-z0-9]{6}$/),
  newPin: pinSchema,
});

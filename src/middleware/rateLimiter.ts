import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { AuthRequest } from "./auth.middleware";

const noopLimiter = (_req: Request, _res: Response, next: NextFunction) => next();

export const globalLimiter = env.NODE_ENV === "development" ? noopLimiter : rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
    data: null,
    error: { code: "RATE_LIMIT_EXCEEDED", details: null },
    meta: null,
  },
});

// Limits how often an OTP can be SENT — 5 attempts per 30 minutes per phone
export const otpLimiter = env.NODE_ENV === "development" ? noopLimiter : rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.body?.phone || req.ip || "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "You don request OTP too many times. Abeg wait 30 minutes and try again.",
    data: null,
    error: { code: "OTP_RATE_LIMIT", details: null },
    meta: null,
  },
} as Parameters<typeof rateLimit>[0]);

// Limits how often an OTP can be VERIFIED — 5 attempts per 30 minutes per phone
export const otpVerifyLimiter = env.NODE_ENV === "development" ? noopLimiter : rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.body?.phone || req.ip || "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "You don try too many times. Abeg wait 30 minutes and try again.",
    data: null,
    error: { code: "OTP_VERIFY_RATE_LIMIT", details: null },
    meta: null,
  },
} as Parameters<typeof rateLimit>[0]);

// Caps direct OpenAI/Whisper cost exposure — these routes have no per-plan quota
// enforcement yet (aiChatsPerDay/voicePerMonth in plans.ts aren't wired to a usage
// counter), so without this a single user can call them without limit. Keyed by
// userId (routes are authenticated) rather than IP, so it holds up behind shared NATs.
export const advisorLimiter = env.NODE_ENV === "development" ? noopLimiter : rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => (req as AuthRequest).userId || req.ip || "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "You've reached the AI advisor limit for now. Please try again shortly.",
    data: null,
    error: { code: "ADVISOR_RATE_LIMIT", details: null },
    meta: null,
  },
} as Parameters<typeof rateLimit>[0]);

export const voiceLimiter = env.NODE_ENV === "development" ? noopLimiter : rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => (req as AuthRequest).userId || req.ip || "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "You've reached the voice input limit for now. Please try again shortly, or switch to manual input.",
    data: null,
    error: { code: "VOICE_RATE_LIMIT", details: null },
    meta: null,
  },
} as Parameters<typeof rateLimit>[0]);

export const authLimiter = env.NODE_ENV === "development" ? noopLimiter : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.body?.phone || req.ip || "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please wait 15 minutes.",
    data: null,
    error: { code: "AUTH_RATE_LIMIT", details: null },
    meta: null,
  },
} as Parameters<typeof rateLimit>[0]);

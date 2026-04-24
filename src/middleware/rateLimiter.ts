import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

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

export const otpLimiter = env.NODE_ENV === "development" ? noopLimiter : rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.body?.phone || req.ip || "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many OTP requests. Try again in 1 hour.",
    data: null,
    error: { code: "OTP_RATE_LIMIT", details: null },
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

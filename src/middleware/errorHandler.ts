import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      data: null,
      error: { code: err.code || "APP_ERROR", details: err.message },
      meta: null,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        details: err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
      },
      meta: null,
    });
    return;
  }

  logger.error("Unhandled error:", err);

  res.status(500).json({
    success: false,
    message: "Something went wrong. Please try again.",
    data: null,
    error: { code: "INTERNAL_ERROR", details: null },
    meta: null,
  });
};

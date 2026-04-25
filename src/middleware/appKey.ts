import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { AppError } from "./errorHandler";

export const requireAppKey = (req: Request, _res: Response, next: NextFunction): void => {
  if (!env.APP_KEY) {
    // Fail closed — if APP_KEY is not configured the entire API is locked down
    next(new AppError(503, "Service not configured", "SERVICE_UNAVAILABLE"));
    return;
  }

  const key = req.headers["x-app-key"];
  if (!key || key !== env.APP_KEY) {
    next(new AppError(403, "Invalid app key", "FORBIDDEN"));
    return;
  }

  next();
};

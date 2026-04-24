import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { AppError } from "./errorHandler";

export const requireAppKey = (req: Request, _res: Response, next: NextFunction): void => {
  if (!env.APP_KEY) {
    next();
    return;
  }

  const key = req.headers["x-app-key"];
  if (!key || key !== env.APP_KEY) {
    next(new AppError(403, "Invalid app key", "FORBIDDEN"));
    return;
  }

  next();
};

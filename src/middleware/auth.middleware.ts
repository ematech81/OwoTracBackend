import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./errorHandler";

export interface AuthRequest extends Request {
  userId?: string;
}

export const authenticate = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    next(new AppError(401, "Authentication required", "UNAUTHORIZED"));
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token", "TOKEN_INVALID"));
  }
};

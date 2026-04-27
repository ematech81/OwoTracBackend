import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_ACCESS_SECRET || "admin-fallback-secret";

export const adminAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    res.status(401).json({ success: false, message: "No token provided" });
    return;
  }
  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET) as { admin: boolean };
    if (!payload.admin) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

import jwt from "jsonwebtoken";
import { env } from "../config/env";

export const signAccessToken = (userId: string): string =>
  jwt.sign({ userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES as jwt.SignOptions["expiresIn"],
  });

export const signRefreshToken = (userId: string): string =>
  jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES as jwt.SignOptions["expiresIn"],
  });

export const verifyRefreshToken = (token: string): { userId: string } => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { userId: string };
};

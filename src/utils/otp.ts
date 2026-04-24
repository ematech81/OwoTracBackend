import { redis } from "../config/redis";
import { env } from "../config/env";

const OTP_PREFIX = "otp:";

export const generateOtp = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const storeOtp = async (phone: string, otp: string): Promise<void> => {
  const key = `${OTP_PREFIX}${phone}`;
  await redis.setex(key, env.OTP_EXPIRES_MINUTES * 60, otp);
};

export const verifyOtp = async (phone: string, otp: string): Promise<boolean> => {
  const key = `${OTP_PREFIX}${phone}`;
  const stored = await redis.get(key);
  if (!stored || stored !== otp) return false;
  await redis.del(key);
  return true;
};

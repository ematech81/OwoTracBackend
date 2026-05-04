import twilio from "twilio";
import { env } from "../config/env";
import { logger } from "../config/logger";

const getClient = () => twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

export const sendSms = async (phone: string, message: string): Promise<boolean> => {
  if (env.FORCE_CONSOLE_OTP || env.NODE_ENV === "development") {
    logger.info(`[SMS → ${phone}]: ${message}`);
    return true;
  }

  try {
    await getClient().messages.create({
      body: message,
      from: env.TWILIO_PHONE_NUMBER,
      to: phone,
    });
    return true;
  } catch (error) {
    logger.error("Twilio SMS failed:", error);
    return false;
  }
};

export const sendOtpSms = async (phone: string, otp: string): Promise<boolean> => {
  const message = `Your OwoTrack verification code is ${otp}. Valid for ${env.OTP_EXPIRES_MINUTES} minutes. Do not share this code with anyone.`;
  return sendSms(phone, message);
};

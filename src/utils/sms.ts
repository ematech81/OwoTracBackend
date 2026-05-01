import { env } from "../config/env";
import { logger } from "../config/logger";

export const sendSms = async (phone: string, message: string): Promise<boolean> => {
  if (env.FORCE_CONSOLE_OTP || env.NODE_ENV === "development") {
    logger.info(`[SMS → ${phone}]: ${message}`);
    return true;
  }

  try {
    const res = await fetch("https://v3.api.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: env.TERMII_API_KEY,
        to: phone,
        from: env.TERMII_SENDER_ID,
        sms: message,
        type: "plain",
        channel: "generic",
      }),
    });

    const data = await res.json() as { message?: string; message_id?: string };

    if (!res.ok || !data.message_id) {
      logger.error("Termii SMS failed:", data);
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Termii SMS error:", error);
    return false;
  }
};

export const sendOtpSms = async (phone: string, otp: string): Promise<boolean> => {
  const message = `Your OwoTrack verification code is ${otp}. Valid for ${env.OTP_EXPIRES_MINUTES} minutes. Do not share this code with anyone.`;
  return sendSms(phone, message);
};

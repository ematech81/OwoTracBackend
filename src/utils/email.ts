import sgMail from "@sendgrid/mail";
import { env } from "../config/env";
import { logger } from "../config/logger";

sgMail.setApiKey(env.SENDGRID_API_KEY);

export const sendEmail = async (
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<boolean> => {
  if (env.FORCE_CONSOLE_OTP || env.NODE_ENV === "development") {
    logger.info(`[EMAIL → ${to}] Subject: ${subject}\n${text}`);
    return true;
  }

  try {
    await sgMail.send({
      to,
      from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
      subject,
      text,
      html: html || text,
    });
    return true;
  } catch (error) {
    logger.error("SendGrid email failed:", error);
    return false;
  }
};

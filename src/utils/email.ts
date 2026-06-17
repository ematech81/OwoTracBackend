import axios from "axios";
import { env } from "../config/env";
import { logger } from "../config/logger";

const BREVO_SMTP_URL = "https://api.brevo.com/v3/smtp/email";

export const sendEmail = async (
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<boolean> => {
  if (env.NODE_ENV === "development") {
    logger.info(`[EMAIL → ${to}] Subject: ${subject}\n${text}`);
    return true;
  }

  if (!env.BREVO_API_KEY) {
    logger.error("[EMAIL] BREVO_API_KEY is not set — email not sent");
    return false;
  }

  try {
    await axios.post(
      BREVO_SMTP_URL,
      {
        sender: { name: env.BREVO_FROM_NAME, email: env.BREVO_FROM_EMAIL },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html || text,
      },
      {
        headers: {
          "api-key": env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    return true;
  } catch (error) {
    logger.error("[EMAIL] Brevo send failed:", error);
    return false;
  }
};

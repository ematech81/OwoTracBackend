import axios, { AxiosError } from "axios";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { AppError } from "../middleware/errorHandler";

// ── BulkSMS Nigeria error code → user-friendly message ─────────────────────

const BSNG_ERRORS: Record<string, string> = {
  "BSNG-1001": "SMS service authentication failed — contact support",
  "BSNG-3001": "SMS service temporarily unavailable — contact support",
  "BSNG-3004": "Too many OTP requests. Please wait and try again.",
  "BSNG-2006": "Invalid phone number format",
};

function mapBsngError(code: string): string {
  return BSNG_ERRORS[code] ?? "Could not send OTP. Please try again.";
}

// ── Phone formatter ─────────────────────────────────────────────────────────

/**
 * Formats a Nigerian phone number to the format BulkSMS expects: 2348012345678
 * Accepts: 08012345678 (11 digits), +2348012345678 (14 chars), 2348012345678 (13 digits)
 * Throws if the number doesn't match a valid Nigerian format.
 */
export function formatNigerianNumber(phone: string): string {
  let n = phone.replace(/[\s\-]/g, "");

  if (n.startsWith("+")) n = n.slice(1);
  if (n.startsWith("0")) n = "234" + n.slice(1);

  // After normalisation must be 13 digits starting with 234
  if (!/^234\d{10}$/.test(n)) {
    throw new AppError(400, "Invalid phone number format", "INVALID_PHONE");
  }

  return n;
}

// ── API helpers ─────────────────────────────────────────────────────────────

function headers() {
  return {
    Authorization: `Bearer ${env.BULKSMS_API_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Sends an OTP code via BulkSMS Nigeria.
 * OTP generation and verification are handled by the caller (locally + Redis).
 * BulkSMS only delivers the pre-generated code.
 */
export async function bulkSmsSendOtp(
  phone: string,
  otpCode: string
): Promise<{ success: boolean; messageId?: string }> {
  const formattedPhone = formatNigerianNumber(phone);

  const body = {
    from: env.BULKSMS_SENDER_ID,
    to: formattedPhone,
    body: `Your OwoTrack verification code is ${otpCode}. Valid for ${env.OTP_EXPIRES_MINUTES} minutes. Do not share this code.`,
  };

  try {
    const res = await axios.post(
      `${env.BULKSMS_BASE_URL}/sms`,
      body,
      { headers: headers() }
    );

    const data = res.data as Record<string, unknown>;
    const code = data?.code as string | undefined;

    if (code === "BSNG-0000") {
      const messageId = data?.message_id as string | undefined;
      logger.info(`BulkSMS OTP dispatched → ${formattedPhone} (id: ${messageId ?? "n/a"})`);
      return { success: true, messageId };
    }

    // Non-zero code means failure even if HTTP 200
    const errMsg = mapBsngError(code ?? "");
    logger.error("BulkSMS send failed:", { code, data });
    throw new AppError(502, errMsg, "OTP_SERVICE_ERROR");
  } catch (err) {
    if (err instanceof AppError) throw err;

    if (err instanceof AxiosError) {
      const data = err.response?.data as Record<string, unknown> | undefined;
      const code = data?.code as string | undefined;
      logger.error("BulkSMS API error:", { status: err.response?.status, data });
      const errMsg = code ? mapBsngError(code) : "Could not send OTP. Please try again.";
      throw new AppError(502, errMsg, "OTP_SERVICE_ERROR");
    }

    throw err;
  }
}

/**
 * Checks the BulkSMS Nigeria wallet balance.
 * Useful for admin monitoring to avoid running out of credits.
 */
export async function checkBulkSmsBalance(): Promise<Record<string, unknown>> {
  try {
    const res = await axios.get(
      `${env.BULKSMS_BASE_URL}/balance`,
      { headers: headers() }
    );
    return res.data as Record<string, unknown>;
  } catch (err) {
    if (err instanceof AxiosError) {
      logger.error("BulkSMS balance check failed:", { status: err.response?.status, data: err.response?.data });
    }
    throw err;
  }
}

import axios, { AxiosError } from "axios";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { redis } from "../config/redis";
import { AppError } from "../middleware/errorHandler";

// ── SendChamp API type definitions ─────────────────────────────────────────

interface SendChampSendOtpPayload {
  channel: "sms";
  sender: string;
  token_type: "numeric";
  token_length: number;
  expiration_time: number; // minutes
  customer_mobile_number: string;
  customer_email_address?: string;
  meta_data?: Record<string, string>;
  in_app_token: boolean;
}

interface SendChampSendOtpData {
  reference: string;
  [key: string]: unknown;
}

interface SendChampVerifyOtpPayload {
  verification_reference: string;
  verification_code: string;
}

interface SendChampVerifyOtpData {
  status?: string;
  [key: string]: unknown;
}

interface SendChampApiResponse<T> {
  code: string;
  status: string;
  message: string;
  data: T;
}

// ── Redis key for storing SendChamp verification references ─────────────────
// Uses a separate "scref:" prefix so it never collides with test-mode OTP keys ("otp:")

const SCREF_PREFIX = "scref:";

async function storeRef(keySuffix: string, reference: string): Promise<void> {
  const ttl = env.SENDCHAMP_OTP_EXPIRY_MINUTES * 60;
  await redis.setex(`${SCREF_PREFIX}${keySuffix}`, ttl, reference);
}

async function getRef(keySuffix: string): Promise<string | null> {
  return redis.get(`${SCREF_PREFIX}${keySuffix}`);
}

async function deleteRef(keySuffix: string): Promise<void> {
  await redis.del(`${SCREF_PREFIX}${keySuffix}`);
}

// ── Phone normalisation ─────────────────────────────────────────────────────

/**
 * Normalises an incoming phone number to E.164 format without the leading '+'.
 * Handles Nigerian numbers: strips '+', replaces a leading '0' with '234'.
 * Examples: '+2349011495230' → '2349011495230', '09011495230' → '2349011495230'
 */
export function normalizePhone(phone: string): string {
  let n = phone.replace(/[\s\-]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  if (n.startsWith("0")) n = "234" + n.slice(1);
  return n;
}

// ── API helpers ─────────────────────────────────────────────────────────────

function headers() {
  return {
    Authorization: `Bearer ${env.SENDCHAMP_PUBLIC_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function handleApiError(err: unknown, fallback: string): never {
  if (err instanceof AxiosError) {
    const body = err.response?.data as Record<string, unknown> | undefined;
    const msg = (body?.message as string) || (body?.error as string) || fallback;
    logger.error("SendChamp API error:", {
      status: err.response?.status,
      body,
    });
    const lower = msg.toLowerCase();
    if (lower.includes("phone") || lower.includes("mobile") || lower.includes("number")) {
      throw new AppError(400, "Invalid phone number. Please use international format.", "INVALID_PHONE");
    }
    throw new AppError(502, "OTP service unavailable. Please try again later.", "OTP_SERVICE_ERROR");
  }
  throw err;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Sends an OTP via SendChamp (production mode) and stores the verification
 * reference in Redis against `redisKeySuffix`.
 *
 * @param phone          - Raw phone from the request (will be normalised)
 * @param redisKeySuffix - Key suffix used to store/retrieve the reference
 *                         (e.g. phone for registration, "resetpin:{phone}" for PIN reset)
 */
export async function sendChampSendOtp(
  phone: string,
  redisKeySuffix: string
): Promise<void> {
  const normalizedPhone = normalizePhone(phone);

  const payload: SendChampSendOtpPayload = {
    channel: "sms",
    sender: env.SENDCHAMP_SENDER_NAME,
    token_type: "numeric",
    token_length: env.SENDCHAMP_OTP_LENGTH,
    expiration_time: env.SENDCHAMP_OTP_EXPIRY_MINUTES,
    customer_mobile_number: normalizedPhone,
    meta_data: { description: "OwoTrack OTP" },
    in_app_token: false,
  };

  try {
    const res = await axios.post<SendChampApiResponse<SendChampSendOtpData>>(
      `${env.SENDCHAMP_BASE_URL}/verification/create`,
      payload,
      { headers: headers() }
    );

    const reference = res.data?.data?.reference;
    if (!reference) {
      logger.error("SendChamp: missing reference in response", res.data);
      throw new AppError(502, "OTP service error. Please try again.", "OTP_SERVICE_ERROR");
    }

    await storeRef(redisKeySuffix, reference);
    logger.info(`SendChamp OTP dispatched → ${normalizedPhone}`);
  } catch (err) {
    if (err instanceof AppError) throw err;
    handleApiError(err, "Failed to send OTP");
  }
}

/**
 * Verifies an OTP by retrieving the stored SendChamp reference from Redis and
 * calling /verification/confirm. Returns `true` on success, `false` on wrong
 * code or expired reference.
 *
 * The reference is deleted from Redis only on a successful verification so the
 * user can retry within the expiry window if they enter the wrong code.
 *
 * @param redisKeySuffix - Same suffix used in `sendChampSendOtp`
 * @param code           - The 6-digit code entered by the user
 */
export async function sendChampVerifyOtp(
  redisKeySuffix: string,
  code: string
): Promise<boolean> {
  const reference = await getRef(redisKeySuffix);
  if (!reference) return false; // reference expired or never stored

  const payload: SendChampVerifyOtpPayload = {
    verification_reference: reference,
    verification_code: code,
  };

  try {
    const res = await axios.post<SendChampApiResponse<SendChampVerifyOtpData>>(
      `${env.SENDCHAMP_BASE_URL}/verification/confirm`,
      payload,
      { headers: headers() }
    );

    const isSuccess =
      res.data?.code === "200" ||
      res.data?.status?.toLowerCase() === "success" ||
      res.data?.message?.toLowerCase().includes("successful");

    if (isSuccess) {
      await deleteRef(redisKeySuffix); // one-time use on success
      return true;
    }
    return false;
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 400) {
      // Wrong code — not a server fault, user can retry
      logger.info(`SendChamp verify: invalid code for ref ${reference.slice(0, 8)}…`);
      return false;
    }
    handleApiError(err, "Failed to verify OTP");
  }
}

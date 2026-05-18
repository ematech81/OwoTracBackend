import crypto from "crypto";
import axios, { AxiosError, AxiosResponse } from "axios";
import { User } from "../users/user.model";
import { getPlan, PlanId, PLANS } from "../../config/plans";
import { env } from "../../config/env";
import { AppError } from "../../middleware/errorHandler";
import { redis } from "../../config/redis";
import { logger } from "../../config/logger";
import { adminNotify } from "../../utils/adminNotify";
import { userNotify } from "../../utils/userNotify";

// ── Korapay API types ──────────────────────────────────────────────────────

interface KorapayInitPayload {
  amount: number;
  currency: "NGN";
  reference: string;
  notification_url: string;
  redirect_url: string;
  customer: { email: string; name: string };
  channels: string[];
  metadata: { userId: string; planId: string };
}

interface KorapayChargeData {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  checkout_url?: string;
  customer: Record<string, unknown>;
  card?: { authorization?: { token?: string } };
  metadata?: Record<string, string>;
}

interface KorapayApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

// ── Korapay helpers ────────────────────────────────────────────────────────

const koraHeaders = () => ({
  Authorization: `Bearer ${env.KORAPAY_SECRET_KEY}`,
  "Content-Type": "application/json",
});

function handleKoraError(err: unknown, fallback: string): never {
  if (err instanceof AxiosError) {
    const body = err.response?.data as Record<string, unknown> | undefined;
    const msg = (body?.message as string) || (body?.error as string) || fallback;
    logger.error("Korapay API error:", { status: err.response?.status, body });
    throw new AppError(
      err.response?.status === 404 ? 422 : 502,
      `Payment service: ${msg}`,
      "PAYMENT_ERROR"
    );
  }
  throw err;
}

function getPlanPrice(planId: PlanId): number {
  switch (planId) {
    case "growth":   return env.KORAPAY_PLAN_GROWTH_MONTHLY;
    case "pro":      return env.KORAPAY_PLAN_PRO_MONTHLY;
    case "business": return env.KORAPAY_PLAN_BUSINESS_MONTHLY;
    default:         return 0;
  }
}

const makeReference = (userId: string) => `OWT-${userId}-${Date.now()}`;

// Must match the redirect_url intercepted by the mobile WebView
const REDIRECT_URL = "https://owotracbackend-production.up.railway.app/payment/callback";

// Korapay calls this URL on every payment event
const NOTIFICATION_URL = "https://owotracbackend-production.up.railway.app/api/v1/subscription/webhook";

// ── Public functions ───────────────────────────────────────────────────────

export async function initializeSubscription(
  userId: string,
  planId: PlanId
): Promise<{ paymentLink: string; txRef: string }> {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");

  const plan = getPlan(planId);
  if (!plan || plan.id === "free") throw new AppError(400, "Plan not available", "PLAN_UNAVAILABLE");

  const email = user.email || `${user.phone.replace(/\D/g, "")}@owotrack.app`;
  const reference = makeReference(userId);
  const amount = getPlanPrice(planId);

  try {
    const res = await axios.post<KorapayApiResponse<KorapayChargeData>>(
      `${env.KORAPAY_BASE_URL}/charges/initialize`,
      {
        amount,
        currency: "NGN",
        reference,
        notification_url: NOTIFICATION_URL,
        redirect_url: REDIRECT_URL,
        customer: { email, name: user.name },
        channels: ["card", "bank_transfer", "ussd", "mobile_money"],
        metadata: { userId: user._id.toString(), planId },
      } satisfies KorapayInitPayload,
      { headers: koraHeaders() }
    );

    const checkoutUrl = res.data?.data?.checkout_url;
    if (!checkoutUrl) {
      logger.error("Korapay: no checkout_url in response", res.data);
      throw new AppError(502, "Payment service error. Please try again.", "PAYMENT_ERROR");
    }

    return { paymentLink: checkoutUrl, txRef: reference };
  } catch (err) {
    if (err instanceof AppError) throw err;
    handleKoraError(err, "Could not initialize checkout");
  }
}

export async function verifyTransaction(txRef: string): Promise<{ planId: string; status: string }> {
  let res: AxiosResponse<KorapayApiResponse<KorapayChargeData>>;
  try {
    res = await axios.get<KorapayApiResponse<KorapayChargeData>>(
      `${env.KORAPAY_BASE_URL}/charges/${encodeURIComponent(txRef)}`,
      { headers: koraHeaders() }
    );
  } catch (err) {
    handleKoraError(err, "Could not verify transaction");
  }

  const data = res!.data.data;

  if (data.status !== "success") throw new AppError(400, "Payment not successful", "PAYMENT_FAILED");
  if (data.currency !== "NGN")   throw new AppError(400, "Invalid payment currency", "PAYMENT_FAILED");

  const meta = data.metadata ?? {};
  const { userId, planId } = meta;
  const expectedAmount = getPlanPrice(planId as PlanId);

  if (data.amount < expectedAmount) {
    throw new AppError(400, "Partial payment not accepted", "PAYMENT_AMOUNT_MISMATCH");
  }

  const cardToken = data.card?.authorization?.token;

  if (userId && planId) {
    await activatePlan(userId, planId, cardToken);
  }

  return { planId: planId ?? "", status: data.status };
}

export async function getStatus(userId: string) {
  const user = await User.findById(userId).select("subscription name phone");
  if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");

  const plan = getPlan(user.subscription.plan);
  return {
    plan: user.subscription.plan,
    status: user.subscription.status,
    startDate: user.subscription.startDate,
    expiresAt: user.subscription.expiresAt,
    planDetails: {
      name: plan.name,
      priceNaira: plan.priceNaira,
      badge: plan.badge,
      limits: plan.limits,
    },
    allPlans: Object.values(PLANS).map((p) => ({
      id: p.id,
      name: p.name,
      priceNaira: p.priceNaira,
      badge: p.badge,
      limits: p.limits,
    })),
  };
}

export async function cancelSubscription(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");

  // Korapay one-time payments have no recurring API subscription to cancel —
  // mark as cancelled in our DB so the plan gate downgrades at the next check.
  await User.findByIdAndUpdate(userId, { "subscription.status": "cancelled" });
  userNotify(
    userId,
    "SUBSCRIPTION_CANCELLED",
    "Subscription Cancelled",
    "Your subscription has been cancelled. You can re-subscribe at any time."
  );
}

/**
 * Verifies the Korapay webhook signature using HMAC-SHA256.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(signature: string, rawBody: string): boolean {
  if (!signature || !env.KORAPAY_WEBHOOK_SECRET) return false;
  const computed = crypto
    .createHmac("sha256", env.KORAPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    // Buffer lengths differ — signature is malformed
    return false;
  }
}

export async function handleWebhookEvent(
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  // Idempotency — deduplicate on reference so retried webhooks are no-ops
  const dedupId = (data.reference as string) || String(data.id ?? "");
  if (dedupId) {
    const dedupKey = `webhook:${event}:${dedupId}`;
    const alreadyProcessed = await redis.set(dedupKey, "1", "EX", 86400, "NX");
    if (alreadyProcessed === null) {
      logger.info(`Korapay webhook duplicate skipped: ${dedupKey}`);
      return;
    }
  }

  if (event === "charge.success" && data.status === "success") {
    const meta = (data.metadata as Record<string, string>) ?? {};
    const { userId, planId } = meta;
    if (!userId || !planId) {
      logger.warn("Korapay webhook: missing userId or planId in metadata", { data });
      return;
    }
    const cardToken = (data.card as any)?.authorization?.token as string | undefined;
    await activatePlan(userId, planId, cardToken);
  }
}

// ── Internal ───────────────────────────────────────────────────────────────

async function activatePlan(userId: string, planId: string, cardToken?: string): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);

  const updateFields: Record<string, unknown> = {
    "subscription.plan":            planId,
    "subscription.status":          "active",
    "subscription.startDate":       now,
    "subscription.expiresAt":       expiresAt,
    "subscription.paymentProvider": "korapay",
    "subscription.autoRenew":       false,
  };

  // Store tokenized card reference if Korapay returned one (for future auto-renewal)
  if (cardToken) {
    updateFields["subscription.cardToken"] = cardToken;
  }

  const user = await User.findByIdAndUpdate(userId, updateFields, { new: true }).select("name phone");

  if (user) {
    adminNotify(
      "NEW_SUBSCRIPTION",
      `${user.name} (${user.phone}) subscribed to ${planId} plan`,
      { userId, planId }
    ).catch(() => {});
    userNotify(
      userId,
      "SUBSCRIPTION_ACTIVATED",
      "Subscription Activated",
      `Your ${planId} plan is now active. Enjoy full access!`,
      { planId }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPRECATED: Replaced by Korapay (2026-05-16). Keep for rollback until 2026-06-16.
// ─────────────────────────────────────────────────────────────────────────────
//
// const FLW_BASE = "https://api.flutterwave.com/v3";
//
// const flwHeaders = () => ({
//   Authorization: `Bearer ${env.FLW_SECRET_KEY}`,
//   "Content-Type": "application/json",
// });
//
// function handleFlwError(err: unknown, fallback: string): never {
//   if (err instanceof AxiosError) {
//     const msg =
//       err.response?.data?.message ||
//       err.response?.data?.error ||
//       fallback;
//     const status = err.response?.status === 404 ? 422 : 502;
//     throw new AppError(status, `Flutterwave: ${msg}`, "FLW_ERROR");
//   }
//   throw err;
// }
//
// // initializeSubscription (Flutterwave version):
// //   POST https://api.flutterwave.com/v3/payments
// //   body: { tx_ref, amount: plan.priceNaira, currency: "NGN", redirect_url, customer, customizations, meta }
// //   returns: res.data.data.link  (paymentLink)
//
// // verifyTransaction (Flutterwave version):
// //   GET https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=...
// //   checks: data.status === "successful", data.currency === "NGN", data.amount >= plan.priceNaira
// //   metadata field was called "meta" (not "metadata")
//
// // verifyWebhookSignature (Flutterwave version):
// //   Simple string compare: return signature === env.FLW_WEBHOOK_HASH
// //   Header name: "verif-hash"
//
// // handleWebhookEvent (Flutterwave version):
// //   event === "charge.completed" && data.status === "successful"
// //   metadata accessed via data.meta (not data.metadata)
// //   dedup key used data.tx_ref (not data.reference)

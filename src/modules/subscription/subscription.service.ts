import axios, { AxiosError } from "axios";
import { User } from "../users/user.model";
import { getPlan, PlanId, PLANS } from "../../config/plans";
import { env } from "../../config/env";
import { AppError } from "../../middleware/errorHandler";
import { redis } from "../../config/redis";
import { adminNotify } from "../../utils/adminNotify";
import { userNotify } from "../../utils/userNotify";

const FLW_BASE = "https://api.flutterwave.com/v3";

const flwHeaders = () => ({
  Authorization: `Bearer ${env.FLW_SECRET_KEY}`,
  "Content-Type": "application/json",
});

function handleFlwError(err: unknown, fallback: string): never {
  if (err instanceof AxiosError) {
    const msg =
      err.response?.data?.message ||
      err.response?.data?.error ||
      fallback;
    const status = err.response?.status === 404 ? 422 : 502;
    throw new AppError(status, `Flutterwave: ${msg}`, "FLW_ERROR");
  }
  throw err;
}

const makeTxRef = (userId: string) => `OWT-${userId}-${Date.now()}`;

// Must match the redirect_url intercepted by the mobile WebView
const REDIRECT_URL = "https://owotracbackend-production.up.railway.app/payment/callback";

export async function initializeSubscription(
  userId: string,
  planId: PlanId
): Promise<{ paymentLink: string; txRef: string }> {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");

  const plan = getPlan(planId);
  if (!plan || plan.id === "free") throw new AppError(400, "Plan not available", "PLAN_UNAVAILABLE");

  const email = user.email || `${user.phone.replace(/\D/g, "")}@owotrack.app`;
  const txRef = makeTxRef(userId);

  try {
    const res = await axios.post(
      `${FLW_BASE}/payments`,
      {
        tx_ref: txRef,
        amount: plan.priceNaira,   // Flutterwave uses real Naira, NOT kobo
        currency: "NGN",
        redirect_url: REDIRECT_URL,
        customer: {
          email,
          name: user.name,
          phonenumber: user.phone,
        },
        customizations: {
          title: "OwoTrack",
          description: `${plan.name} plan — monthly subscription`,
        },
        meta: { userId: user._id.toString(), planId },
      },
      { headers: flwHeaders() }
    );

    return { paymentLink: res.data.data.link, txRef };
  } catch (err) {
    handleFlwError(err, "Could not initialize checkout");
  }
}

export async function verifyTransaction(txRef: string): Promise<{ planId: string; status: string }> {
  let res;
  try {
    res = await axios.get(
      `${FLW_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
      { headers: flwHeaders() }
    );
  } catch (err) {
    handleFlwError(err, "Could not verify transaction");
  }

  const data = res!.data.data;

  if (data.status !== "successful") throw new AppError(400, "Payment not successful", "PAYMENT_FAILED");
  if (data.currency !== "NGN") throw new AppError(400, "Invalid payment currency", "PAYMENT_FAILED");

  const meta = (data.meta as Record<string, string>) ?? {};
  const { userId, planId } = meta;
  const plan = getPlan(planId);

  if (data.amount < plan.priceNaira) {
    throw new AppError(400, "Partial payment not accepted", "PAYMENT_AMOUNT_MISMATCH");
  }

  if (userId && planId) {
    await activatePlan(userId, planId);
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

  // Flutterwave one-time payments have no recurring subscription to cancel via API —
  // just mark as cancelled in our DB so the plan gate downgrades at next check
  await User.findByIdAndUpdate(userId, { "subscription.status": "cancelled" });
  userNotify(
    userId,
    "SUBSCRIPTION_CANCELLED",
    "Subscription Cancelled",
    "Your subscription has been cancelled. You can re-subscribe at any time."
  );
}

export function verifyWebhookSignature(signature: string): boolean {
  // Flutterwave uses a direct hash comparison, not HMAC
  return signature === env.FLW_WEBHOOK_HASH;
}

export async function handleWebhookEvent(
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  // Idempotency guard — use tx_ref or transaction id as dedup key
  const dedupId = (data.tx_ref as string) || String(data.id ?? "");
  if (dedupId) {
    const dedupKey = `webhook:${event}:${dedupId}`;
    const alreadyProcessed = await redis.set(dedupKey, "1", "EX", 86400, "NX");
    if (alreadyProcessed === null) return; // duplicate event
  }

  if (event === "charge.completed" && data.status === "successful") {
    const meta = (data.meta as Record<string, string>) ?? {};
    const { userId, planId } = meta;
    if (!userId || !planId) return;
    await activatePlan(userId, planId);
  }
}

async function activatePlan(userId: string, planId: string): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);

  const user = await User.findByIdAndUpdate(
    userId,
    {
      "subscription.plan": planId,
      "subscription.status": "active",
      "subscription.startDate": now,
      "subscription.expiresAt": expiresAt,
    },
    { new: true }
  ).select("name phone");

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

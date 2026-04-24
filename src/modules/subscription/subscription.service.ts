import axios, { AxiosError } from "axios";
import crypto from "crypto";
import { User, IUser } from "../users/user.model";
import { getPlan, PlanId, PLANS } from "../../config/plans";
import { env } from "../../config/env";
import { AppError } from "../../middleware/errorHandler";

function handlePaystackError(err: unknown, fallback: string): never {
  if (err instanceof AxiosError) {
    const msg =
      err.response?.data?.message ||
      err.response?.data?.error ||
      fallback;
    const status = err.response?.status === 404 ? 422 : 502;
    throw new AppError(status, `Paystack: ${msg}`, "PAYSTACK_ERROR");
  }
  throw err;
}

const PAYSTACK_BASE = "https://api.paystack.co";
const paystackHeaders = () => ({
  Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
  "Content-Type": "application/json",
});

async function ensureCustomer(user: IUser): Promise<string> {
  if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");
  if (user.subscription.paystackCustomerCode) return user.subscription.paystackCustomerCode;

  const email = user.email || `${user.phone.replace(/\D/g, "")}@owotrack.app`;
  const nameParts = user.name.trim().split(/\s+/);
  try {
    const res = await axios.post(
      `${PAYSTACK_BASE}/customer`,
      {
        email,
        first_name: nameParts[0],
        last_name: nameParts.slice(1).join(" ") || nameParts[0],
        phone: user.phone,
      },
      { headers: paystackHeaders() }
    );
    const customerCode: string = res.data.data.customer_code;
    await User.findByIdAndUpdate(user._id, { "subscription.paystackCustomerCode": customerCode });
    return customerCode;
  } catch (err) {
    handlePaystackError(err, "Could not create customer");
  }
}

export async function initializeSubscription(
  userId: string,
  planId: PlanId
): Promise<{ authorizationUrl: string; reference: string }> {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");

  const plan = getPlan(planId);
  if (!plan.paystackPlanCode) throw new AppError(400, "Plan not available", "PLAN_UNAVAILABLE");

  const email = user.email || `${user.phone.replace(/\D/g, "")}@owotrack.app`;
  await ensureCustomer(user);

  try {
    const res = await axios.post(
      `${PAYSTACK_BASE}/transaction/initialize`,
      {
        email,
        amount: plan.priceNaira * 100,
        plan: plan.paystackPlanCode,
        metadata: { userId: user._id.toString(), planId },
        callback_url: "owotrack://subscription/verify",
      },
      { headers: paystackHeaders() }
    );

    return {
      authorizationUrl: res.data.data.authorization_url,
      reference: res.data.data.reference,
    };
  } catch (err) {
    handlePaystackError(err, "Could not initialize checkout");
  }
}

export async function verifyTransaction(reference: string): Promise<{ planId: string; status: string }> {
  let res;
  try {
    res = await axios.get(`${PAYSTACK_BASE}/transaction/verify/${reference}`, {
      headers: paystackHeaders(),
    });
  } catch (err) {
    handlePaystackError(err, "Could not verify transaction");
  }

  const data = res!.data.data;
  if (data.status !== "success") throw new AppError(400, "Payment not successful", "PAYMENT_FAILED");

  const { userId, planId } = data.metadata ?? {};
  if (userId && planId) {
    await activatePlan(userId, planId, data.subscription?.subscription_code, data.subscription?.email_token);
  }

  return { planId, status: data.status };
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

  const { paystackSubscriptionCode, paystackEmailToken } = user.subscription;
  if (paystackSubscriptionCode && paystackEmailToken) {
    try {
      await axios.post(
        `${PAYSTACK_BASE}/subscription/disable`,
        { code: paystackSubscriptionCode, token: paystackEmailToken },
        { headers: paystackHeaders() }
      );
    } catch (err) {
      handlePaystackError(err, "Could not cancel subscription on Paystack");
    }
  }

  await User.findByIdAndUpdate(userId, { "subscription.status": "cancelled" });
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const hash = crypto
    .createHmac("sha512", env.PAYSTACK_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return hash === signature;
}

export async function handleWebhookEvent(event: string, data: Record<string, unknown>): Promise<void> {
  if (event === "charge.success" || event === "subscription.create") {
    const metadata = (data.metadata as Record<string, string>) ?? {};
    const { userId, planId } = metadata;
    if (!userId || !planId) return;

    const sub = data.subscription as Record<string, string> | undefined;
    await activatePlan(userId, planId, sub?.subscription_code, sub?.email_token);
  }

  if (event === "subscription.disable" || event === "subscription.not_renew") {
    const subCode = data.subscription_code as string;
    if (subCode) {
      await User.findOneAndUpdate(
        { "subscription.paystackSubscriptionCode": subCode },
        { "subscription.status": "cancelled" }
      );
    }
  }

  if (event === "invoice.payment_failed") {
    const sub = data.subscription as Record<string, string> | undefined;
    const subCode = sub?.subscription_code;
    if (subCode) {
      await User.findOneAndUpdate(
        { "subscription.paystackSubscriptionCode": subCode },
        { "subscription.status": "expired" }
      );
    }
  }

  if (event === "subscription.expiring_cards") {
    // Future: notify user to update card
  }
}

async function activatePlan(
  userId: string,
  planId: string,
  subscriptionCode?: string,
  emailToken?: string
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);

  await User.findByIdAndUpdate(userId, {
    "subscription.plan": planId,
    "subscription.status": "active",
    "subscription.startDate": now,
    "subscription.expiresAt": expiresAt,
    ...(subscriptionCode && { "subscription.paystackSubscriptionCode": subscriptionCode }),
    ...(emailToken && { "subscription.paystackEmailToken": emailToken }),
  });
}

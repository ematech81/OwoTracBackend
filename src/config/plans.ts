export type PlanId = "free" | "growth" | "pro" | "business";

export interface PlanLimits {
  salesPerMonth: number;      // -1 = unlimited
  expensesPerMonth: number;
  activeCredits: number;
  stockItems: number;
  aiChatsPerDay: number;
  voicePerMonth: number;
  whatsappReminders: number;
  reportsAccess: "today" | "weekly" | "full";
  canExport: boolean;
}

export interface PlanConfig {
  id: PlanId;
  name: string;
  priceNaira: number;
  paystackPlanCode: string;
  limits: PlanLimits;
  badge?: string;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Starter",
    priceNaira: 0,
    paystackPlanCode: "",
    limits: {
      salesPerMonth: 50,
      expensesPerMonth: 30,
      activeCredits: 5,
      stockItems: 20,
      aiChatsPerDay: 0,
      voicePerMonth: 0,
      whatsappReminders: 0,
      reportsAccess: "today",
      canExport: false,
    },
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceNaira: 2500,
    paystackPlanCode: process.env.PAYSTACK_PLAN_GROWTH ?? "",
    badge: "Popular",
    limits: {
      salesPerMonth: 300,
      expensesPerMonth: 150,
      activeCredits: 30,
      stockItems: 100,
      aiChatsPerDay: 10,
      voicePerMonth: 20,
      whatsappReminders: 30,
      reportsAccess: "weekly",
      canExport: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceNaira: 5000,
    paystackPlanCode: process.env.PAYSTACK_PLAN_PRO ?? "",
    limits: {
      salesPerMonth: -1,
      expensesPerMonth: -1,
      activeCredits: -1,
      stockItems: -1,
      aiChatsPerDay: -1,
      voicePerMonth: 60,
      whatsappReminders: -1,
      reportsAccess: "full",
      canExport: false,
    },
  },
  business: {
    id: "business",
    name: "Business",
    priceNaira: 10000,
    paystackPlanCode: process.env.PAYSTACK_PLAN_BUSINESS ?? "",
    limits: {
      salesPerMonth: -1,
      expensesPerMonth: -1,
      activeCredits: -1,
      stockItems: -1,
      aiChatsPerDay: -1,
      voicePerMonth: -1,
      whatsappReminders: -1,
      reportsAccess: "full",
      canExport: true,
    },
  },
};

export function getPlan(planId: string): PlanConfig {
  return PLANS[planId as PlanId] ?? PLANS.free;
}

export function isUnlimited(val: number): boolean {
  return val === -1;
}

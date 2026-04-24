import { z } from "zod";

const categoryEnum = z.enum([
  "stock_purchase", "transportation", "market_levy",
  "shop_rent", "labor", "utilities", "communication",
  "packaging", "equipment", "personal",
  "loan_repayment", "other",
]);

export const createExpenseSchema = z.object({
  date: z.string(),
  description: z.string().min(1).trim(),
  amount: z.number().min(0),
  category: categoryEnum.default("other"),
  isRecurring: z.boolean().default(false),
  recurringFrequency: z.enum(["daily", "weekly", "monthly", "none"]).default("none"),
  rawInput: z.string().optional(),
  localId: z.string().optional(),
});

export const updateExpenseSchema = z.object({
  date: z.string().optional(),
  description: z.string().min(1).trim().optional(),
  amount: z.number().min(0).optional(),
  category: categoryEnum.optional(),
  isRecurring: z.boolean().optional(),
  recurringFrequency: z.enum(["daily", "weekly", "monthly", "none"]).optional(),
});

export const parseTextSchema = z.object({
  input: z.string().min(1).max(500),
});

export const expensesQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  category: categoryEnum.optional(),
});

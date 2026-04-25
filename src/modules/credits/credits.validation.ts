import { z } from "zod";

export const createCreditSchema = z.object({
  customerName: z.string().min(1, "Customer name is required").trim().max(100),
  customerPhone: z.string().trim().optional(),
  description: z.string().min(1, "Description is required").trim().max(300),
  amount: z.number().min(1, "Amount must be greater than 0"),
  dueDate: z.string().refine((v) => !isNaN(Date.parse(v)), { message: "Invalid due date" }),
  localId: z.string().optional(),
});

export const recordPaymentSchema = z.object({
  amount: z.number().min(0.01, "Payment amount must be greater than 0"),
  note: z.string().trim().max(200).optional(),
});

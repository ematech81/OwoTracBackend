import { z } from "zod";

const saleItemSchema = z.object({
  productName: z.string().min(1).trim(),
  category: z.string().default("other"),
  quantity: z.number().min(0),
  unit: z.string().default("piece"),
  unitPrice: z.number().min(0),
  costPrice: z.number().min(0).default(0),
});

export const createSaleSchema = z.object({
  date: z.string().datetime().or(z.string().date()),
  items: z.array(saleItemSchema).min(1, "At least one item required"),
  paymentType: z.enum(["cash", "transfer", "pos", "credit", "mixed"]).default("cash"),
  notes: z.string().optional(),
  inputMethod: z.enum(["voice", "text", "manual_form"]).default("manual_form"),
  rawInput: z.string().optional(),
  localId: z.string().optional(),
});

export const updateSaleSchema = z.object({
  date: z.string().optional(),
  items: z.array(saleItemSchema).min(1).optional(),
  paymentType: z.enum(["cash", "transfer", "pos", "credit", "mixed"]).optional(),
  notes: z.string().optional(),
});

export const parseTextSchema = z.object({
  input: z.string().min(1, "Input is required").max(500),
});

export const salesQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  category: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
});

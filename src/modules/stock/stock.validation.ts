import { z } from "zod";

export const createStockSchema = z.object({
  name: z.string().min(1).trim(),
  category: z.string().optional().default("General"),
  emoji: z.string().optional().default("📦"),
  qty: z.number().min(0),
  unit: z.string().optional().default("unit"),
  costPrice: z.number().min(0).optional().default(0),
  sellingPrice: z.number().min(0).optional().default(0),
  dateEntered: z.string(),
  lowStockThreshold: z.number().min(1).optional().default(5),
  localId: z.string().optional(),
});

export const updateStockSchema = z.object({
  name: z.string().min(1).trim().optional(),
  category: z.string().optional(),
  emoji: z.string().optional(),
  qty: z.number().min(0).optional(),
  unit: z.string().optional(),
  costPrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  dateEntered: z.string().optional(),
  lowStockThreshold: z.number().min(1).optional(),
});

export const adjustQtySchema = z.object({
  delta: z.number(),
});

export const stockQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
  category: z.string().optional(),
});

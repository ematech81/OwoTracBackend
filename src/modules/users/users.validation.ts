import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(2).trim().optional(),
  businessName: z.string().trim().optional(),
  businessType: z
    .enum([
      "food_items", "fashion_clothing", "electronics",
      "provisions", "raw_materials", "pharmacy",
      "cosmetics", "agriculture", "services", "other",
    ])
    .optional(),
  location: z
    .object({
      state: z.string().optional(),
      city: z.string().optional(),
      market: z.string().optional(),
    })
    .optional(),
  preferredLanguage: z
    .enum(["pidgin", "yoruba", "igbo", "hausa", "english"])
    .optional(),
  currency: z.string().length(3).optional(),
});

export const updateNotificationsSchema = z.object({
  dailyReminder: z.boolean().optional(),
  dailyReminderTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Format must be HH:MM")
    .optional(),
  weeklyReport: z.boolean().optional(),
  creditReminders: z.boolean().optional(),
});

export const pushTokenSchema = z.object({
  pushToken: z.string().min(1),
});

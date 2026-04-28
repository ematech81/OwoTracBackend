import { AdminNotification, AdminNotificationType } from "../models/adminNotification.model";

export async function adminNotify(
  type: AdminNotificationType,
  message: string,
  metadata?: Record<string, string>
): Promise<void> {
  try {
    await AdminNotification.create({ type, message, metadata });
  } catch {
    // Silent — notification failure must never break the main flow
  }
}

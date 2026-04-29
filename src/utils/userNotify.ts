import { UserNotification, UserNotificationType } from "../models/userNotification.model";

export async function userNotify(
  userId: string,
  type: UserNotificationType,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await UserNotification.create({ userId, type, title, message, metadata });
  } catch {
    // Fire-and-forget — never crash the caller over a notification failure
  }
}

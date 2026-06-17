import { logger } from "../../config/logger";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  channelId?: string;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

async function sendBatch(messages: ExpoPushMessage[]): Promise<void> {
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    logger.warn(`Expo push batch failed: ${res.status}`);
  }
}

export const notificationService = {
  async send(token: string, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
    if (!token?.startsWith("ExponentPushToken")) return;
    try {
      await sendBatch([{ to: token, title, body, sound: "default", data, channelId: "default" }]);
    } catch (err) {
      logger.error("Push send error:", err);
    }
  },

  async sendMany(messages: { token: string; title: string; body: string; data?: Record<string, unknown> }[]): Promise<void> {
    const valid = messages.filter((m) => m.token?.startsWith("ExponentPushToken"));
    if (valid.length === 0) return;
    try {
      // Expo allows max 100 per batch
      for (let i = 0; i < valid.length; i += 100) {
        const chunk = valid.slice(i, i + 100).map(({ token, title, body, data }) => ({
          to: token, title, body, sound: "default" as const, data, channelId: "default",
        }));
        await sendBatch(chunk);
      }
    } catch (err) {
      logger.error("Push sendMany error:", err);
    }
  },
};

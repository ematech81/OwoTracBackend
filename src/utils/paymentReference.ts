import { randomUUID } from "crypto";

export const KORAPAY_APP_PREFIX = "OWO";

/**
 * Generates a Korapay payment reference in the format OWO-{uuid_v4}.
 * The OWO prefix is used by the webhook router to identify and forward
 * Korapay events to OwoTrack's webhook handler.
 */
export function generatePaymentReference(): string {
  return `${KORAPAY_APP_PREFIX}-${randomUUID()}`;
}

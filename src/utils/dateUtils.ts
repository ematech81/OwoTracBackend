// Nigeria is a fixed UTC+1 offset with no DST. Calendar-day/week/month boundaries
// must be computed relative to WAT explicitly — using the server process's local
// timezone (via Date's local-time getters/setters like setHours/getDay) silently
// breaks whenever the server isn't configured for WAT, and no TZ env var is set
// anywhere in this deployment. Every caller here wants the WAT calendar boundary,
// so these are WAT-correct unconditionally rather than depending on server config.
const WAT_OFFSET_MS = 60 * 60 * 1000;

export function startOfDay(date: Date = new Date()): Date {
  const watShifted = new Date(date.getTime() + WAT_OFFSET_MS);
  const utcMidnight = Date.UTC(watShifted.getUTCFullYear(), watShifted.getUTCMonth(), watShifted.getUTCDate());
  return new Date(utcMidnight - WAT_OFFSET_MS);
}

export function startOfWeek(date: Date = new Date()): Date {
  const dayStart = startOfDay(date);
  const watShifted = new Date(date.getTime() + WAT_OFFSET_MS);
  const dayOfWeek = watShifted.getUTCDay(); // 0 = Sunday
  return new Date(dayStart.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
}

export function startOfMonth(date: Date = new Date()): Date {
  const watShifted = new Date(date.getTime() + WAT_OFFSET_MS);
  const utcMidnightFirst = Date.UTC(watShifted.getUTCFullYear(), watShifted.getUTCMonth(), 1);
  return new Date(utcMidnightFirst - WAT_OFFSET_MS);
}

// Full [start, end] window for the WAT calendar day a given date-only string (e.g.
// "2026-09-18", already a bare WAT calendar date — no shift needed) or Date instant
// (an arbitrary moment, shifted to find which WAT calendar day it falls on) falls on.
export function dayBoundsWAT(dateOrStr: string | Date): { start: Date; end: Date } {
  const start = typeof dateOrStr === "string"
    ? new Date(new Date(`${dateOrStr}T00:00:00.000Z`).getTime() - WAT_OFFSET_MS)
    : startOfDay(dateOrStr);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

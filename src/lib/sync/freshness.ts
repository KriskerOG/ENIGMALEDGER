import type { FreshnessStatus } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeFreshnessStatus(timestamp: string | Date | null | undefined, now = new Date()): FreshnessStatus {
  if (!timestamp) {
    return "unknown";
  }

  const sourceTime = timestamp instanceof Date ? timestamp : new Date(timestamp);

  if (Number.isNaN(sourceTime.getTime())) {
    return "unknown";
  }

  const age = Math.max(0, now.getTime() - sourceTime.getTime());

  if (age <= DAY_MS) {
    return "fresh";
  }

  if (age <= 7 * DAY_MS) {
    return "recent";
  }

  return "stale";
}


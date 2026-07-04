import type { FailureFeed } from "../adapters.js";

interface FailureEntry {
  key: string;
  status: string;
  timestamp: number;
}

export function createRingBufferFailureFeed(maxEntries = 200): FailureFeed {
  const buffer: FailureEntry[] = [];

  return {
    recentFailures(windowMs: number): Map<string, number> {
      const cutoff = Date.now() - windowMs;
      const result = new Map<string, number>();
      for (const entry of buffer) {
        if (entry.status === "success") continue;
        if (entry.timestamp < cutoff) continue;
        result.set(entry.key, (result.get(entry.key) ?? 0) + 1);
      }
      return result;
    },
    record(key: string, status: string): void {
      buffer.unshift({ key, status, timestamp: Date.now() });
      if (buffer.length > maxEntries) {
        buffer.length = maxEntries;
      }
    },
  };
}

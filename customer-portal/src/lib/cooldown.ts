// Per-key cooldown used by email-sending auth endpoints (forgot-password,
// resend-verification) so they can't be used to flood an inbox or burn
// through the email-send quota. In-memory, so it's per-instance and resets
// on deploy — a courtesy limit, not a security boundary. Callers must apply
// it before any DB lookup and answer with their generic success response so
// the cooldown itself can't be used for user enumeration.
export function createCooldown(windowMs: number): (key: string) => boolean {
  const lastRequestAt = new Map<string, number>();

  return function underCooldown(key: string): boolean {
    const now = Date.now();
    if (lastRequestAt.size > 1000) {
      for (const [k, at] of lastRequestAt) {
        if (now - at >= windowMs) lastRequestAt.delete(k);
      }
    }
    const last = lastRequestAt.get(key);
    if (last !== undefined && now - last < windowMs) return true;
    lastRequestAt.set(key, now);
    return false;
  };
}

// Per-key failed-attempt limiter used by login so credentials can't be
// brute-forced at full speed. Unlike createCooldown it only counts failures
// (a fixed window of up to maxFailures), so legitimate users are never
// throttled by successful requests. Same caveats as above: in-memory,
// per-instance, resets on deploy — a damper, not a security boundary.
export function createFailureLimiter(windowMs: number, maxFailures: number) {
  const failures = new Map<string, { count: number; windowStart: number }>();

  return {
    isBlocked(key: string): boolean {
      const entry = failures.get(key);
      if (!entry) return false;
      if (Date.now() - entry.windowStart >= windowMs) {
        failures.delete(key);
        return false;
      }
      return entry.count >= maxFailures;
    },
    recordFailure(key: string): void {
      const now = Date.now();
      if (failures.size > 1000) {
        for (const [k, entry] of failures) {
          if (now - entry.windowStart >= windowMs) failures.delete(k);
        }
      }
      const entry = failures.get(key);
      if (!entry || now - entry.windowStart >= windowMs) {
        failures.set(key, { count: 1, windowStart: now });
      } else {
        entry.count += 1;
      }
    },
    reset(key: string): void {
      failures.delete(key);
    },
  };
}

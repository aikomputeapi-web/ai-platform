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

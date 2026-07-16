// Shared grace-window logic for portal<->OmniRoute key reconciliation.
//
// Key creation is a two-step write (OmniRoute key first, portal mapping
// second — see app/api/keys/route.ts), and reconciliation snapshots the two
// stores concurrently. A snapshot taken between the two steps sees the new
// OmniRoute key as "orphaned" and would delete a credential the user was
// just issued; the mirror-image race (mapping visible, key not in the omni
// snapshot yet) would mark a brand-new mapping inactive — and once the
// reconciler's revoked-key sweep runs, that wrong inactive state gets the
// real credential deleted. Anything younger than this window is skipped and
// re-checked on the next cycle instead.
export const RECONCILE_GRACE_MS = 10 * 60 * 1000;

export function isWithinGracePeriod(createdAt: string | Date | undefined): boolean {
  if (!createdAt) return false; // unknown age — reconcile as before
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && t > Date.now() - RECONCILE_GRACE_MS;
}

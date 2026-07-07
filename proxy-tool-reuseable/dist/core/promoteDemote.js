export async function promoteProxyToGlobal(db, log, candidate, country, poolSize, namePrefix) {
    const now = new Date().toISOString();
    const proxyUrl = `${candidate.type}://${candidate.host}:${candidate.port}`;
    const pool = await db.listGlobalPool();
    const existing = pool.find((p) => p.host === candidate.host && p.port === candidate.port);
    if (existing) {
        if (typeof db.__directUpdate === "function") {
            await db.__directUpdate(existing.registryId, now, candidate.id);
        }
        return;
    }
    await db.promoteToGlobalCandidate(candidate, country, poolSize, namePrefix);
    log.info({
        host: candidate.host,
        port: candidate.port,
        type: candidate.type,
        url: proxyUrl,
    }, `Promoted ${country} proxy to global pool (Tier 3)`);
}
/**
 * Demote a Tier 3 (global pool) proxy back down to `targetTier` (2 or 1) and
 * optionally pre-seed `consecutive_failures` so that the next failure in the
 * target tier trips that tier's demotion rule immediately. This powers the
 * "Tier 3 fails once → Tier 2; if it immediately fails again → Tier 1" rule:
 * a fresh tier-3 demote targets Tier 2 with failureHeadStart set so the next
 * single Tier 2 check failure crosses the Tier 2 demote threshold and drops
 * it to Tier 1.
 */
export async function demoteTier3Proxy(db, log, registryId, host, targetTier, failureHeadStart = 0) {
    await db.demoteFromGlobalPoolToTier(registryId, host, targetTier, failureHeadStart);
    log.info({ host, targetTier, failureHeadStart }, `Demoted Tier 3 proxy to Tier ${targetTier}`);
}
//# sourceMappingURL=promoteDemote.js.map
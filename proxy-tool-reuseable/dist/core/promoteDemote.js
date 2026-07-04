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
export async function demoteTier3ToTier2(db, log, registryId, host) {
    await db.demoteFromGlobalPool(registryId, host);
    log.info({ host }, "Demoted Tier 3 proxy to Tier 2");
}
//# sourceMappingURL=promoteDemote.js.map
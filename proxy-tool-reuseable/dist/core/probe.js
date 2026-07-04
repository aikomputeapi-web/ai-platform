const PROXY_TEST_TARGETS = [
    "https://api.openai.com/v1/models",
    "https://api.anthropic.com/v1/messages",
    "https://oidc.us-east-1.amazonaws.com/",
];
export async function testProxyMultiTarget(probe, proxyUrl, perTargetTimeoutMs, targets = PROXY_TEST_TARGETS) {
    const start = Date.now();
    for (const target of targets) {
        try {
            const { ok } = await probe.test(proxyUrl, target, perTargetTimeoutMs);
            if (ok) {
                return { ok: true, latencyMs: Date.now() - start };
            }
        }
        catch {
            // try the next target
        }
    }
    return { ok: false, latencyMs: Date.now() - start };
}
//# sourceMappingURL=probe.js.map
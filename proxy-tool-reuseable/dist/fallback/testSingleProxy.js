export function createTestSingleProxy(probe) {
    return async (proxyUrl, targetUrl, timeoutMs = 3000) => {
        return probe.test(proxyUrl, targetUrl, timeoutMs);
    };
}
//# sourceMappingURL=testSingleProxy.js.map
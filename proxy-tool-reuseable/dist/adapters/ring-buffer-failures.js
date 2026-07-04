export function createRingBufferFailureFeed(maxEntries = 200) {
    const buffer = [];
    return {
        recentFailures(windowMs) {
            const cutoff = Date.now() - windowMs;
            const result = new Map();
            for (const entry of buffer) {
                if (entry.status === "success")
                    continue;
                if (entry.timestamp < cutoff)
                    continue;
                result.set(entry.key, (result.get(entry.key) ?? 0) + 1);
            }
            return result;
        },
        record(key, status) {
            buffer.unshift({ key, status, timestamp: Date.now() });
            if (buffer.length > maxEntries) {
                buffer.length = maxEntries;
            }
        },
    };
}
//# sourceMappingURL=ring-buffer-failures.js.map
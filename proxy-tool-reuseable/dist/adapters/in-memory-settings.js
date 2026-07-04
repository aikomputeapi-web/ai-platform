import { DEFAULT_JOB_SETTINGS, getSettingsHash } from "../core/settings.js";
export function createInMemorySettingsStore(initial) {
    let current = { ...DEFAULT_JOB_SETTINGS, ...initial };
    let hash = getSettingsHash(current);
    return {
        async get() {
            return { ...current };
        },
        shouldReload() {
            const newHash = getSettingsHash(current);
            if (newHash !== hash) {
                hash = newHash;
                return true;
            }
            return false;
        },
        set(s) {
            current = { ...current, ...s };
            hash = getSettingsHash(current);
        },
    };
}
//# sourceMappingURL=in-memory-settings.js.map
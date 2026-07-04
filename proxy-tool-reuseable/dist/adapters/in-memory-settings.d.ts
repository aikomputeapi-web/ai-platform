import type { SettingsStore } from "../adapters.js";
import type { JobSettings } from "../types.js";
export declare function createInMemorySettingsStore(initial?: Partial<JobSettings>): SettingsStore & {
    set(s: Partial<JobSettings>): void;
};
//# sourceMappingURL=in-memory-settings.d.ts.map
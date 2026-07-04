import type { SettingsStore } from "../adapters.js";
import type { JobSettings } from "../types.js";
import { DEFAULT_JOB_SETTINGS, getSettingsHash } from "../core/settings.js";

export function createInMemorySettingsStore(
  initial?: Partial<JobSettings>
): SettingsStore & { set(s: Partial<JobSettings>): void } {
  let current: JobSettings = { ...DEFAULT_JOB_SETTINGS, ...initial };
  let hash = getSettingsHash(current);

  return {
    async get(): Promise<JobSettings> {
      return { ...current };
    },
    shouldReload(): boolean {
      const newHash = getSettingsHash(current);
      if (newHash !== hash) {
        hash = newHash;
        return true;
      }
      return false;
    },
    set(s: Partial<JobSettings>): void {
      current = { ...current, ...s };
      hash = getSettingsHash(current);
    },
  };
}

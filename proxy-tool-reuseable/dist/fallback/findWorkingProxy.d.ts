import type { CandidateSource, ProxyProbe, Logger } from "../adapters.js";
export declare function clearProxyFallbackCache(): void;
export declare function findWorkingProxy(candidateSource: CandidateSource, probe: ProxyProbe, log: Logger, targetHostname: string, targetUrl: string): Promise<string | null>;
//# sourceMappingURL=findWorkingProxy.d.ts.map
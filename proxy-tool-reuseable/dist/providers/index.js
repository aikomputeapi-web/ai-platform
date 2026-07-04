import { OneproxyProvider } from "./oneproxy.js";
import { ProxiflyProvider } from "./proxifly.js";
import { IplocateProvider } from "./iplocate.js";
import { ProxyPoolProvider } from "./proxypool.js";
import { ProxyScraperProvider } from "./proxyscraper.js";
const ALL_PROVIDERS = [
    new OneproxyProvider(),
    new ProxiflyProvider(),
    new IplocateProvider(),
    new ProxyPoolProvider(),
    new ProxyScraperProvider(),
];
export function getProvider(id) {
    return ALL_PROVIDERS.find((p) => p.id === id);
}
export function getEnabledProviders() {
    return ALL_PROVIDERS.filter((p) => p.isEnabled());
}
export function getAllProviders() {
    return ALL_PROVIDERS;
}
//# sourceMappingURL=index.js.map
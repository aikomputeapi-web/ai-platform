import type { FreeProxyProvider, FreeProxySourceId } from "./types.js";
import { OneproxyProvider } from "./oneproxy.js";
import { ProxiflyProvider } from "./proxifly.js";
import { IplocateProvider } from "./iplocate.js";
import { ProxyPoolProvider } from "./proxypool.js";
import { ProxyScraperProvider } from "./proxyscraper.js";

const ALL_PROVIDERS: FreeProxyProvider[] = [
  new OneproxyProvider(),
  new ProxiflyProvider(),
  new IplocateProvider(),
  new ProxyPoolProvider(),
  new ProxyScraperProvider(),
];

export function getProvider(id: FreeProxySourceId): FreeProxyProvider | undefined {
  return ALL_PROVIDERS.find((p) => p.id === id);
}

export function getEnabledProviders(): FreeProxyProvider[] {
  return ALL_PROVIDERS.filter((p) => p.isEnabled());
}

export function getAllProviders(): FreeProxyProvider[] {
  return ALL_PROVIDERS;
}

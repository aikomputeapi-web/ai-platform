'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, ShieldCheck, X } from 'lucide-react';

type ProviderBreaker = {
  state?: string;
  failures?: number;
  retryAfterMs?: number;
  lastFailure?: string | null;
};

type OperationsData = {
  health: {
    status?: string;
    system?: {
      uptime?: number;
      version?: string;
      nodeVersion?: string;
      memoryUsage?: { rss?: number; heapUsed?: number; heapTotal?: number };
    };
    providerSummary?: { configuredCount?: number; activeCount?: number; monitoredCount?: number };
    providerHealth?: Record<string, ProviderBreaker>;
    rateLimitStatus?: Record<string, { queued?: number; running?: number }>;
    learnedLimits?: Record<string, { limit?: number; remaining?: number; minTime?: number; lastUpdated?: number }>;
    lockouts?: Record<string, { reason?: string; until?: string | null }>;
    sessions?: {
      activeCount?: number;
      stickyBoundCount?: number;
      byApiKey?: Record<string, unknown>;
      top?: Array<{ sessionId: string; requestCount?: number; connectionId?: string; idleMs?: number; ageMs?: number }>;
    };
    quotaMonitor?: { active?: number; alerting?: number; exhausted?: number; backoff?: number };
    inflightRequests?: number;
  };
  providerMetrics: Record<string, { totalRequests?: number; totalSuccesses?: number; successRate?: number; avgLatencyMs?: number }>;
  degradation?: {
    isDegraded?: boolean;
    summary?: { full?: number; reduced?: number; minimal?: number; default?: number };
    features?: Array<{ feature?: string; level?: string; capability?: string; reason?: string; since?: string }>;
  };
};

const CB_STYLES: Record<string, { tone: string; label: string }> = {
  CLOSED: { tone: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Healthy' },
  HALF_OPEN: { tone: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Recovering' },
  OPEN: { tone: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Down' },
};

function formatUptime(seconds?: number) {
  const value = Number(seconds || 0);
  const d = Math.floor(value / 86400);
  const h = Math.floor((value % 86400) / 3600);
  const m = Math.floor((value % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(bytes?: number) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(timestamp?: string | null) {
  if (!timestamp) return '—';
  const diffMs = Math.max(0, Date.now() - new Date(timestamp).getTime());
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return '<1m';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
}

export default function AdminOperationsPage() {
  const [data, setData] = useState<OperationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/operations');
      if (!res.ok) {
        setError('Failed to load operations');
        return;
      }
      setData(await res.json());
      setError('');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  const breakerEntries = useMemo(() => Object.entries(data?.health.providerHealth || {}), [data]);
  const unhealthyBreakers = useMemo(() => breakerEntries.filter(([, breaker]) => breaker.state !== 'CLOSED'), [breakerEntries]);
  const healthyBreakers = useMemo(() => breakerEntries.filter(([, breaker]) => breaker.state === 'CLOSED'), [breakerEntries]);
  const providerRows = useMemo(() => Object.entries(data?.providerMetrics || {}).sort((a, b) => (b[1].totalRequests || 0) - (a[1].totalRequests || 0)).slice(0, 8), [data]);
  const degradation = data?.degradation;
  const degradedFeatures = useMemo(() => (degradation?.features || []).filter((entry) => entry.level && entry.level !== 'full'), [degradation]);

  async function resetCircuitBreakers() {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/operations', {
        method: 'DELETE',
      });
      if (!res.ok) {
        setError('Failed to reset circuit breakers');
        return;
      }
      await fetchData();
    } catch {
      setError('Network error');
    } finally {
      setActionLoading(false);
    }
  }

  if (error && !data && !loading) {
    return (
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center px-6" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="glass-card p-8 w-full max-w-lg text-center animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-[rgba(239,68,68,0.12)] text-[#f87171] mx-auto mb-4 flex items-center justify-center">
            <X size={20} />
          </div>
          <h2 className="text-xl font-semibold mb-2">Operations failed to load</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-5">{error}</p>
          <button type="button" onClick={() => void fetchData()} className="btn-primary inline-flex items-center gap-2">
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading operations…</p>
        </div>
      </div>
    );
  }

  const health = data.health || {};
  const system = health.system || {};
  const providerSummary = health.providerSummary || {};
  const sessions = health.sessions || {};
  const quota = health.quotaMonitor || {};
  const statusHealthy = String(health.status || '').toLowerCase() === 'healthy';

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <div className="glass-card p-6 mb-8 border border-[rgba(20,184,166,0.18)] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at top right, rgba(20,184,166,0.18), transparent 35%)' }} />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(20,184,166,0.12)] text-[rgb(45,212,191)] text-xs font-semibold uppercase tracking-wider mb-4 border border-[rgba(20,184,166,0.2)]">
                Operations
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05] mb-3">
                Live platform health, routing, and failover signals.
              </h1>
              <p className="text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
                This panel pulls OmniRoute&apos;s health payload and provider metrics into the customer portal so the owner can spot breakers, queue pressure, and system drift without jumping systems.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => void fetchData()} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-2">
                <RefreshCw size={14} />
                Refresh
              </button>
              <button onClick={() => void resetCircuitBreakers()} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-2 text-red-300" disabled={actionLoading}>
                <ShieldCheck size={14} />
                Reset Breakers
              </button>

            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'System', value: statusHealthy ? 'Healthy' : 'Degraded', sub: health.status || 'unknown', color: statusHealthy ? '#10b981' : '#f59e0b' },
            { label: 'Providers', value: String(providerSummary.configuredCount ?? breakerEntries.length), sub: `${providerSummary.activeCount ?? 0} active`, color: '#ffffff' },
            { label: 'Sessions', value: String(sessions.activeCount ?? 0), sub: `${sessions.stickyBoundCount ?? 0} sticky-bound`, color: '#a1a1aa' },
            { label: 'Alerts', value: String((quota.alerting || 0) + unhealthyBreakers.length + degradedFeatures.length), sub: `${quota.exhausted || 0} exhausted quota`, color: '#ef4444' },
          ].map((card) => (
            <div key={card.label} className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--color-text-muted)] text-xs font-medium">{card.label}</span>
                <span className="text-base" style={{ color: card.color }}>●</span>
              </div>
              <div className="stat-value text-2xl">{card.value}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">{card.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-6 mb-8">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold">System Snapshot</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Uptime, runtime size, and breaker state at a glance.</p>
              </div>
              <span className={statusHealthy ? 'badge-success' : 'badge-warning'}>{statusHealthy ? 'operational' : 'attention required'}</span>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-primary)' }}>
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Uptime</div>
                <div className="text-2xl font-semibold">{formatUptime(system.uptime)}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">v{system.version || 'unknown'} · Node {system.nodeVersion || 'unknown'}</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-primary)' }}>
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Memory RSS</div>
                <div className="text-2xl font-semibold">{formatBytes(system.memoryUsage?.rss)}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">Heap {formatBytes(system.memoryUsage?.heapUsed)} / {formatBytes(system.memoryUsage?.heapTotal)}</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-primary)' }}>
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Breaker Mix</div>
                <div className="text-2xl font-semibold">{breakerEntries.length}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">{unhealthyBreakers.length} unhealthy · {healthyBreakers.length} healthy</div>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold">Queue Pressure</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Requests waiting or running inside routing.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-primary)' }}>
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Active Sessions</div>
                <div className="text-2xl font-semibold">{sessions.activeCount ?? 0}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">{Object.keys(sessions.byApiKey || {}).length} keys with activity</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-primary)' }}>
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Inflight</div>
                <div className="text-2xl font-semibold">{health.inflightRequests ?? 0}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">current requests in flight</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-primary)' }}>
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Quota Alerts</div>
                <div className="text-2xl font-semibold">{quota.alerting ?? 0}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">{quota.backoff ?? 0} backoff states</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-primary)' }}>
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Rate Limiters</div>
                <div className="text-2xl font-semibold">{Object.keys(health.rateLimitStatus || {}).length}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">active limiters tracked</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid xl:grid-cols-2 gap-6 mb-8">
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Provider Breakers</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Circuit breaker status from OmniRoute health.</p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                {breakerEntries.length.toLocaleString()} providers
              </span>
            </div>
            <div className="p-6 space-y-4">
              {breakerEntries.length > 0 ? (
                <>
                  {unhealthyBreakers.length > 0 && (
                    <div className="space-y-2">
                      {unhealthyBreakers.map(([provider, breaker]) => {
                        const style = CB_STYLES[breaker.state || 'OPEN'] || CB_STYLES.OPEN;
                        return (
                          <div key={provider} className={`rounded-xl p-4 border ${style.tone}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-semibold truncate">{provider}</div>
                                <div className="text-xs mt-1 opacity-80">
                                  {breaker.failures || 0} failures · retry {breaker.retryAfterMs ? `${Math.round((breaker.retryAfterMs || 0) / 1000)}s` : '—'}
                                </div>
                              </div>
                              <span className="badge-warning">{style.label}</span>
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)] mt-2">
                              Last failure: {formatRelativeTime(breaker.lastFailure)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {healthyBreakers.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Operational</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {healthyBreakers.map(([provider]) => (
                          <div key={provider} className="rounded-lg px-3 py-2 bg-emerald-500/5 border border-emerald-500/10 text-sm">
                            {provider}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">No breaker data available yet.</p>
              )}
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Provider Metrics</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Request volume, success rate, and latency.</p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                top {providerRows.length.toLocaleString()}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wider" style={{ background: 'var(--color-bg-secondary)' }}>
                    <th className="px-6 py-3 font-semibold">Provider</th>
                    <th className="px-4 py-3 font-semibold text-right">Requests</th>
                    <th className="px-4 py-3 font-semibold text-right">Success</th>
                    <th className="px-4 py-3 font-semibold text-right">Rate</th>
                    <th className="px-4 py-3 font-semibold text-right">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {providerRows.length > 0 ? providerRows.map(([provider, metric]) => (
                    <tr key={provider} className="border-t border-[rgba(255,255,255,0.03)] hover:bg-[var(--color-bg-card)] transition-colors">
                      <td className="px-6 py-4 font-medium">{provider}</td>
                      <td className="px-4 py-4 text-right">{(metric.totalRequests || 0).toLocaleString()}</td>
                      <td className="px-4 py-4 text-right">{(metric.totalSuccesses || 0).toLocaleString()}</td>
                      <td className="px-4 py-4 text-right">
                        <span className={(metric.successRate || 0) >= 95 ? 'badge-success' : (metric.successRate || 0) >= 80 ? 'badge-warning' : 'badge-danger'}>
                          {metric.successRate || 0}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-[var(--color-text-muted)]">{metric.avgLatencyMs || 0} ms</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-[var(--color-text-muted)]">
                        No provider metrics available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 mb-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Alert Center</h2>
              <p className="text-sm text-[var(--color-text-muted)]">Degradation, lockouts, and quota pressure in one place.</p>
            </div>
            <span className={degradation?.isDegraded ? 'badge-warning' : 'badge-success'}>
              {degradation?.isDegraded ? 'active alerts' : 'clear'}
            </span>
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="rounded-xl p-4 border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Degradation Summary</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'full', value: degradation?.summary?.full ?? 0, tone: '#10b981' },
                  { label: 'reduced', value: degradation?.summary?.reduced ?? 0, tone: '#f59e0b' },
                  { label: 'minimal', value: degradation?.summary?.minimal ?? 0, tone: '#f97316' },
                  { label: 'default', value: degradation?.summary?.default ?? 0, tone: '#ef4444' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg p-3 bg-[var(--color-bg-primary)]">
                    <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{item.label}</div>
                    <div className="text-xl font-semibold mt-1" style={{ color: item.tone }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4 border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Degraded Features</div>
              {degradedFeatures.length > 0 ? (
                <div className="space-y-3">
                  {degradedFeatures.slice(0, 6).map((entry) => (
                    <div key={entry.feature} className="rounded-lg p-3 bg-[var(--color-bg-primary)]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-sm truncate">{entry.feature}</div>
                        <span className="badge-warning uppercase">{entry.level}</span>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-1">{entry.capability}</div>
                      {entry.reason && <div className="text-xs text-[var(--color-text-secondary)] mt-2">{entry.reason}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">No degraded features currently tracked.</p>
              )}
            </div>

            <div className="rounded-xl p-4 border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Routing Notes</div>
              <div className="space-y-3">
                <div className="rounded-lg p-3 bg-[var(--color-bg-primary)]">
                  <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Lockouts</div>
                  <div className="text-xl font-semibold mt-1">{Object.keys(health.lockouts || {}).length}</div>
                </div>
                <div className="rounded-lg p-3 bg-[var(--color-bg-primary)]">
                  <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Rate limiters</div>
                  <div className="text-xl font-semibold mt-1">{Object.keys(health.rateLimitStatus || {}).length}</div>
                </div>
                <div className="rounded-lg p-3 bg-[var(--color-bg-primary)]">
                  <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Quota monitors</div>
                  <div className="text-xl font-semibold mt-1">{quota.active ?? 0}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Session Pressure</h2>
              <p className="text-sm text-[var(--color-text-muted)]">Currently active sessions and the hottest keys.</p>
            </div>
            <span className="badge-accent inline-flex items-center gap-2">
              <Activity size={14} />
              live routing
            </span>
          </div>
          {Array.isArray(sessions.top) && sessions.top.length > 0 ? (
            <div className="grid lg:grid-cols-2 gap-4">
              {sessions.top.slice(0, 6).map((session) => (
                <div key={session.sessionId} className="rounded-xl p-4 border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="font-mono text-xs text-[var(--color-text-secondary)] truncate">{session.sessionId}</div>
                    <span className="badge-success">{session.requestCount || 0} reqs</span>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {session.connectionId ? `Conn ${session.connectionId.slice(0, 8)} · ` : ''}
                    idle {Math.round((session.idleMs || 0) / 1000)}s · age {Math.round((session.ageMs || 0) / 1000)}s
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No active sessions are being tracked right now.</p>
          )}
        </div>
      </div>
    </div>
  );
}

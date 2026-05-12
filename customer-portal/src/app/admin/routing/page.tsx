'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { ArrowRight, RefreshCw, Route, Shield, Waypoints } from 'lucide-react';

type ProviderBreaker = {
  state?: string;
  failures?: number;
  retryAfterMs?: number;
  lastFailure?: string | null;
};

type RoutingData = {
  health: {
    status?: string;
    providerSummary?: { configuredCount?: number; activeCount?: number; monitoredCount?: number };
    providerHealth?: Record<string, ProviderBreaker>;
    rateLimitStatus?: Record<string, { queued?: number; running?: number }>;
    learnedLimits?: Record<string, { limit?: number; remaining?: number; minTime?: number; lastUpdated?: number }>;
    lockouts?: Record<string, { reason?: string; until?: string | null }>;
    sessions?: {
      activeCount?: number;
      stickyBoundCount?: number;
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

function formatUptime(count?: number) {
  return `${Number(count || 0).toLocaleString()} providers`;
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

function formatDuration(ms?: number) {
  if (typeof ms !== 'number' || Number.isNaN(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function AdminRoutingPage() {
  const [data, setData] = useState<RoutingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);

  const fetchData = useCallback(async (adminSecret: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/operations', {
        headers: { Authorization: `Bearer ${adminSecret}` },
      });
      if (!res.ok) {
        setError(res.status === 403 ? 'Invalid admin secret' : 'Failed to load routing');
        setAuthed(false);
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

  const breakerEntries = useMemo(() => Object.entries(data?.health.providerHealth || {}), [data]);
  const healthyBreakers = useMemo(() => breakerEntries.filter(([, breaker]) => breaker.state === 'CLOSED'), [breakerEntries]);
  const unhealthyBreakers = useMemo(() => breakerEntries.filter(([, breaker]) => breaker.state !== 'CLOSED'), [breakerEntries]);
  const providerRows = useMemo(() => Object.entries(data?.providerMetrics || {}).sort((a, b) => (b[1].totalRequests || 0) - (a[1].totalRequests || 0)), [data]);
  const rateLimitRows = useMemo(() => Object.entries(data?.health.rateLimitStatus || {}).sort((a, b) => (b[1].queued || 0) - (a[1].queued || 0)), [data]);
  const learnedLimitRows = useMemo(() => Object.entries(data?.health.learnedLimits || {}).sort((a, b) => (b[1].remaining || 0) - (a[1].remaining || 0)), [data]);
  const lockoutRows = useMemo(() => Object.entries(data?.health.lockouts || {}), [data]);
  const sessions = data?.health.sessions || {};
  const quota = data?.health.quotaMonitor || {};
  const statusHealthy = String(data?.health.status || '').toLowerCase() === 'healthy';

  if (!authed) {
    return (
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center px-6" style={{ background: 'var(--color-bg-primary)' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAuthed(true);
            void fetchData(secret);
          }}
          className="glass-card p-8 w-full max-w-md animate-fade-in"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #14b8a6, #6366f1)' }}>
              <Route size={18} />
            </div>
            <div>
              <h1 className="text-xl font-bold">Routing Center</h1>
              <p className="text-xs text-[var(--color-text-muted)]">Enter your admin secret to continue</p>
            </div>
          </div>
          {error && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Admin secret" className="input-field mb-4" autoFocus />
          <button type="submit" className="btn-primary w-full">Open Routing</button>
        </form>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading routing…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <div className="glass-card p-6 mb-8 border border-[rgba(20,184,166,0.18)] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at top right, rgba(20,184,166,0.18), transparent 35%)' }} />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(20,184,166,0.12)] text-[rgb(45,212,191)] text-xs font-semibold uppercase tracking-wider mb-4 border border-[rgba(20,184,166,0.2)]">
                Routing
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05] mb-3">
                Watch provider health, failover, and rate limiting in one place.
              </h1>
              <p className="text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
                This page isolates the mechanics behind OmniRoute so you can debug breakers, lockouts, learned limits, and active sessions without the rest of the operations surface.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => void fetchData(secret)} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-2">
                <RefreshCw size={14} />
                Refresh
              </button>
              <Link href="/admin/operations" className="btn-secondary text-xs py-1.5 px-3">Operations</Link>
              <Link href="/admin/models" className="btn-secondary text-xs py-1.5 px-3">Models</Link>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'System', value: statusHealthy ? 'Healthy' : 'Degraded', sub: data.health.status || 'unknown', color: statusHealthy ? '#10b981' : '#f59e0b' },
            { label: 'Providers', value: formatUptime(data.health.providerSummary?.configuredCount), sub: `${data.health.providerSummary?.activeCount ?? 0} active`, color: '#6366f1' },
            { label: 'Inflight', value: String(data.health.inflightRequests ?? 0), sub: 'current requests', color: '#8b5cf6' },
            { label: 'Alerts', value: String((quota.alerting || 0) + unhealthyBreakers.length), sub: `${quota.exhausted || 0} quota exhausted`, color: '#ef4444' },
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

        <div className="grid xl:grid-cols-[1.1fr_0.9fr] gap-6 mb-8">
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Provider Breakers</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Open, recovering, and healthy circuit states.</p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">{breakerEntries.length.toLocaleString()} tracked</span>
            </div>
            <div className="p-6 space-y-4">
              {breakerEntries.length > 0 ? (
                <>
                  {unhealthyBreakers.length > 0 && (
                    <div className="space-y-3">
                      {unhealthyBreakers.map(([provider, breaker]) => {
                        const style = CB_STYLES[breaker.state || 'OPEN'] || CB_STYLES.OPEN;
                        return (
                          <div key={provider} className={`rounded-xl p-4 border ${style.tone}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-semibold truncate">{provider}</div>
                                <div className="text-xs mt-1 opacity-80">
                                  {breaker.failures || 0} failures · retry {formatDuration(breaker.retryAfterMs)}
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

          <div className="glass-card p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold">Routing Summary</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Quick health indicators for the failover layer.</p>
              </div>
              <Shield size={16} className="text-[var(--color-accent)]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-4 bg-[var(--color-bg-primary)]">
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Active Sessions</div>
                <div className="text-2xl font-semibold">{sessions.activeCount ?? 0}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">{sessions.stickyBoundCount ?? 0} sticky-bound</div>
              </div>
              <div className="rounded-xl p-4 bg-[var(--color-bg-primary)]">
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Rate Limiters</div>
                <div className="text-2xl font-semibold">{Object.keys(data.health.rateLimitStatus || {}).length}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">{quota.backoff ?? 0} backoff states</div>
              </div>
              <div className="rounded-xl p-4 bg-[var(--color-bg-primary)]">
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Learned Limits</div>
                <div className="text-2xl font-semibold">{Object.keys(data.health.learnedLimits || {}).length}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">adaptive provider caps</div>
              </div>
              <div className="rounded-xl p-4 bg-[var(--color-bg-primary)]">
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Lockouts</div>
                <div className="text-2xl font-semibold">{Object.keys(data.health.lockouts || {}).length}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">blocked provider accounts</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid xl:grid-cols-2 gap-6 mb-8">
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Rate Limit Status</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Queues and running volume by limiter.</p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">{rateLimitRows.length.toLocaleString()} limiters</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wider" style={{ background: 'var(--color-bg-secondary)' }}>
                    <th className="px-6 py-3 font-semibold">Limiter</th>
                    <th className="px-4 py-3 font-semibold text-right">Queued</th>
                    <th className="px-4 py-3 font-semibold text-right">Running</th>
                  </tr>
                </thead>
                <tbody>
                  {rateLimitRows.length > 0 ? rateLimitRows.map(([key, value]) => (
                    <tr key={key} className="border-t border-[rgba(255,255,255,0.03)] hover:bg-[var(--color-bg-card)] transition-colors">
                      <td className="px-6 py-4 font-medium">{key}</td>
                      <td className="px-4 py-4 text-right">{value.queued || 0}</td>
                      <td className="px-4 py-4 text-right">{value.running || 0}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} className="px-6 py-10 text-center text-[var(--color-text-muted)]">No rate limiter data available yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Learned Limits</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Adaptive limits and freshness across providers.</p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">{learnedLimitRows.length.toLocaleString()} tracked</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wider" style={{ background: 'var(--color-bg-secondary)' }}>
                    <th className="px-6 py-3 font-semibold">Provider</th>
                    <th className="px-4 py-3 font-semibold text-right">Limit</th>
                    <th className="px-4 py-3 font-semibold text-right">Remaining</th>
                    <th className="px-4 py-3 font-semibold text-right">Min Time</th>
                  </tr>
                </thead>
                <tbody>
                  {learnedLimitRows.length > 0 ? learnedLimitRows.map(([key, value]) => (
                    <tr key={key} className="border-t border-[rgba(255,255,255,0.03)] hover:bg-[var(--color-bg-card)] transition-colors">
                      <td className="px-6 py-4 font-medium">{key}</td>
                      <td className="px-4 py-4 text-right">{value.limit ?? '—'}</td>
                      <td className="px-4 py-4 text-right">{value.remaining ?? '—'}</td>
                      <td className="px-4 py-4 text-right">{formatDuration(value.minTime)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-[var(--color-text-muted)]">No learned-limit data available yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-6">
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

          <div className="space-y-6">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Lockouts</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">Providers that are temporarily blocked or limited.</p>
                </div>
                <Waypoints size={16} className="text-[var(--color-accent)]" />
              </div>
              <div className="space-y-3">
                {lockoutRows.length > 0 ? lockoutRows.map(([provider, lockout]) => (
                  <div key={provider} className="rounded-xl p-4 bg-[var(--color-bg-primary)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{provider}</div>
                      <span className="badge-warning">locked</span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">{lockout.reason || 'No reason provided'}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-2">
                      Until: {lockout.until ? formatRelativeTime(lockout.until) : 'indefinite'}
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-[var(--color-text-muted)]">No lockouts currently tracked.</p>
                )}
              </div>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Hot Sessions</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">The busiest sessions currently in memory.</p>
                </div>
              </div>
              <div className="space-y-3">
                {Array.isArray(sessions.top) && sessions.top.length > 0 ? sessions.top.slice(0, 5).map((session) => (
                  <div key={session.sessionId} className="rounded-xl p-4 bg-[var(--color-bg-primary)]">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="font-mono text-xs text-[var(--color-text-secondary)] truncate">{session.sessionId}</div>
                      <span className="badge-success">{session.requestCount || 0} reqs</span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {session.connectionId ? `Conn ${session.connectionId.slice(0, 8)} · ` : ''}
                      idle {Math.round((session.idleMs || 0) / 1000)}s · age {Math.round((session.ageMs || 0) / 1000)}s
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-[var(--color-text-muted)]">No active sessions are being tracked right now.</p>
                )}
              </div>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Routing Links</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">Jump to related control-center views.</p>
                </div>
                <ArrowRight size={16} className="text-[var(--color-accent)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/admin/operations" className="btn-secondary text-center py-2">Operations</Link>
                <Link href="/admin/models" className="btn-secondary text-center py-2">Models</Link>
                <Link href="/admin/usage" className="btn-secondary text-center py-2">Usage</Link>
                <Link href="/admin/settings" className="btn-secondary text-center py-2">Settings</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

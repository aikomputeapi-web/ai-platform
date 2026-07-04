'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type ProviderBreaker = {
  state?: string;
  failures?: number;
  retryAfterMs?: number;
  lastFailure?: string | null;
};

type RoutingHealth = {
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

type RoutingData = {
  health: RoutingHealth | null;
  providerMetrics: Record<string, { totalRequests?: number; totalSuccesses?: number; successRate?: number; avgLatencyMs?: number }>;
  degradation?: {
    isDegraded?: boolean;
    summary?: { full?: number; reduced?: number; minimal?: number; default?: number } | null;
    features?: Array<{ feature?: string; level?: string; capability?: string; reason?: string; since?: string }>;
  };
};

const CB_STYLES: Record<string, { tone: React.CSSProperties; label: string; badge: string }> = {
  CLOSED: { tone: { borderColor: 'var(--accent)', background: 'var(--accent-dim)', color: 'var(--accent)' }, label: 'Healthy', badge: 'badge-success' },
  HALF_OPEN: { tone: { borderColor: '#f59e0b', background: 'rgba(245, 158, 11, 0.05)', color: '#f59e0b' }, label: 'Recovering', badge: 'badge-warning' },
  OPEN: { tone: { borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444' }, label: 'Down', badge: 'badge-danger' },
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/operations');
      if (!res.ok) {
        setError('Failed to load routing');
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

  const breakerEntries = useMemo(() => Object.entries(data?.health?.providerHealth || {}), [data]);
  const healthyBreakers = useMemo(() => breakerEntries.filter(([, breaker]) => breaker.state === 'CLOSED'), [breakerEntries]);
  const unhealthyBreakers = useMemo(() => breakerEntries.filter(([, breaker]) => breaker.state !== 'CLOSED'), [breakerEntries]);
  const providerRows = useMemo(() => Object.entries(data?.providerMetrics || {}).sort((a, b) => (b[1].totalRequests || 0) - (a[1].totalRequests || 0)), [data]);
  const rateLimitRows = useMemo(() => Object.entries(data?.health?.rateLimitStatus || {}).sort((a, b) => (b[1].queued || 0) - (a[1].queued || 0)), [data]);
  const learnedLimitRows = useMemo(() => Object.entries(data?.health?.learnedLimits || {}).sort((a, b) => (b[1].remaining || 0) - (a[1].remaining || 0)), [data]);
  const lockoutRows = useMemo(() => Object.entries(data?.health?.lockouts || {}), [data]);
  const health: Partial<RoutingHealth> = data?.health ?? {};
  const sessions = health.sessions || {};
  const quota = health.quotaMonitor || {};
  const statusHealthy = String(health.status || '').toLowerCase() === 'healthy';

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (error && !data && !loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
        <div className="alert-error text-center" style={{ padding: '24px', background: 'rgba(239,68,68,0.1)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Routing failed to load</h2>
          <p className="text-12 text-muted mb-16">{error}</p>
          <button type="button" onClick={() => void fetchData()} className="btn-border btn-small">
            Retry Routing
          </button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
        <div className="auth-spinner" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="dash-page-header flex flex-wrap gap-20" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="dash-page-title">OmniRoute Routing Registry</h1>
          <p className="dash-page-sub">
            Monitor failover circuit breakers, learned API limits, lockouts, and rate limiter queues.
          </p>
        </div>
        <div className="flex gap-8">
          <button
            onClick={() => void fetchData()}
            className="btn-border btn-small inline-flex items-center gap-6"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-error mb-24" style={{ background: 'rgba(239,68,68,0.1)' }}>
          Error: {error}
        </div>
      )}

      {/* Metrics */}
      <div className="dash-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {[
          { label: 'System status', value: statusHealthy ? 'Healthy' : 'Degraded', sub: health.status || 'unknown', color: statusHealthy ? 'var(--accent)' : '#f59e0b' },
          { label: 'Provider Nodes', value: formatUptime(health.providerSummary?.configuredCount), sub: `${health.providerSummary?.activeCount ?? 0} online`, color: 'var(--text)' },
          { label: 'Inflight Requests', value: String(health.inflightRequests ?? 0), sub: 'current requests', color: 'var(--muted)' },
          { label: 'Alerting breakers', value: String((quota.alerting || 0) + unhealthyBreakers.length), sub: `${quota.exhausted || 0} exhausted quota`, color: '#ef4444' },
        ].map((card) => (
          <div key={card.label} className="dash-stat">
            <div className="dash-stat-label">
              <span>{card.label}</span>
              <span style={{ color: card.color }}>●</span>
            </div>
            <div className="dash-stat-value">{card.value}</div>
            <div className="dash-stat-sub">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Grid: Breakers and routing overview */}
      <div className="dash-grid-2 mb-24">
        <div className="dash-card mb-0">
          <div className="dash-card-title flex-between">
            <span>Provider Circuit Breakers</span>
            <span className="badge badge-accent">{breakerEntries.length.toLocaleString()} nodes</span>
          </div>

          <div className="dash-stack">
            {unhealthyBreakers.length > 0 && (
              <div className="flex flex-col gap-8">
                <span className="mono text-muted text-10 uppercase">Unhealthy Node Alerts</span>
                {unhealthyBreakers.map(([provider, breaker]) => {
                  const style = CB_STYLES[breaker.state || 'OPEN'] || CB_STYLES.OPEN;
                  return (
                    <div key={provider} style={{ border: '1px solid', padding: '12px', ...style.tone }}>
                      <div className="flex-between">
                        <strong className="mono">{provider}</strong>
                        <span className={`badge ${style.badge}`}>{style.label}</span>
                      </div>
                      <div style={{ fontSize: '11px', marginTop: '6px' }}>
                        {breaker.failures || 0} consecutive failures · retry window: {formatDuration(breaker.retryAfterMs)}
                      </div>
                      <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.8 }}>
                        Last logged down: {formatRelativeTime(breaker.lastFailure)} ago
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <span className="block mono text-muted text-10 uppercase mb-8">Operational Nodes</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
                {healthyBreakers.length > 0 ? healthyBreakers.map(([provider]) => (
                  <div key={provider} className="card text-11 font-600" style={{ padding: '8px 12px' }}>
                    {provider}
                  </div>
                )) : (
                  <div className="text-muted text-11 mono">No operational providers active.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="dash-card mb-0">
          <div className="dash-card-title">Routing Summary</div>
          <div className="dash-params-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="dash-param">
              <div className="dash-param-label">Active Sessions</div>
              <div className="dash-param-value">{sessions.activeCount ?? 0}</div>
              <div className="text-10 text-muted mono" style={{ marginTop: '4px' }}>
                {sessions.stickyBoundCount ?? 0} sticky bound
              </div>
            </div>
            <div className="dash-param">
              <div className="dash-param-label">Rate Limiters</div>
              <div className="dash-param-value">{Object.keys(health.rateLimitStatus || {}).length}</div>
              <div className="text-10 text-muted mono" style={{ marginTop: '4px' }}>
                {quota.backoff ?? 0} backoff states
              </div>
            </div>
            <div className="dash-param">
              <div className="dash-param-label">Learned limits</div>
              <div className="dash-param-value">{Object.keys(health.learnedLimits || {}).length}</div>
              <div className="text-10 text-muted mono" style={{ marginTop: '4px' }}>
                adaptive caps
              </div>
            </div>
            <div className="dash-param">
              <div className="dash-param-label">Active Lockouts</div>
              <div className="dash-param-value">{Object.keys(health.lockouts || {}).length}</div>
              <div className="text-10 text-muted mono" style={{ marginTop: '4px' }}>
                blocked providers
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Rate Limits & Learned Limits */}
      <div className="dash-grid-2 mb-24">
        <div className="dash-card mb-0 p-0 overflow-hidden">
          <div className="dash-card-title" style={{ padding: '24px 24px 0 24px' }}>Rate Limit Registry Queues</div>
          <div className="overflow-x-auto">
            <table className="dash-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '24px' }}>Limiter Context</th>
                  <th className="text-right">Queued</th>
                  <th className="text-right" style={{ paddingRight: '24px' }}>Running</th>
                </tr>
              </thead>
              <tbody>
                {rateLimitRows.length > 0 ? rateLimitRows.map(([key, value]) => (
                  <tr key={key}>
                    <td className="font-600" style={{ paddingLeft: '24px' }}>{key}</td>
                    <td className="text-right mono">{value.queued || 0}</td>
                    <td className="text-right mono" style={{ paddingRight: '24px' }}>{value.running || 0}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="text-center text-muted" style={{ padding: '24px' }}>No active limit queues.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dash-card mb-0 p-0 overflow-hidden">
          <div className="dash-card-title" style={{ padding: '24px 24px 0 24px' }}>Learned limit coefficients</div>
          <div className="overflow-x-auto">
            <table className="dash-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '24px' }}>Provider Node</th>
                  <th className="text-right">Learned Limit</th>
                  <th className="text-right">Remaining capacity</th>
                  <th className="text-right" style={{ paddingRight: '24px' }}>Min cooldown time</th>
                </tr>
              </thead>
              <tbody>
                {learnedLimitRows.length > 0 ? learnedLimitRows.map(([key, value]) => (
                  <tr key={key}>
                    <td className="font-600" style={{ paddingLeft: '24px' }}>{key}</td>
                    <td className="text-right mono">{value.limit ?? '—'}</td>
                    <td className="text-right mono">{value.remaining ?? '—'}</td>
                    <td className="text-right mono" style={{ paddingRight: '24px' }}>{formatDuration(value.minTime)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="text-center text-muted" style={{ padding: '24px' }}>No learned limits.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Grid: Provider performance & lockouts/sessions */}
      <div className="dash-grid-2">
        <div className="dash-card mb-0 p-0 overflow-hidden">
          <div className="dash-card-title flex-between" style={{ padding: '24px 24px 0 24px' }}>
            <span>Provider Performance telemetry</span>
            <span className="badge badge-accent">all nodes</span>
          </div>
          <div className="overflow-x-auto">
            <table className="dash-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '24px' }}>Provider Name</th>
                  <th className="text-right">Total requests</th>
                  <th className="text-right">Successes</th>
                  <th className="text-right">Success Rate</th>
                  <th className="text-right" style={{ paddingRight: '24px' }}>Latency</th>
                </tr>
              </thead>
              <tbody>
                {providerRows.length > 0 ? providerRows.map(([provider, metric]) => {
                  const rate = metric.successRate || 0;
                  const rateClass = rate >= 95 ? 'badge-success' : rate >= 80 ? 'badge-warning' : 'badge-danger';
                  return (
                    <tr key={provider}>
                      <td className="font-600" style={{ paddingLeft: '24px' }}>{provider}</td>
                      <td className="text-right mono">{(metric.totalRequests || 0).toLocaleString()}</td>
                      <td className="text-right mono">{(metric.totalSuccesses || 0).toLocaleString()}</td>
                      <td className="text-right">
                        <span className={`badge ${rateClass}`} style={{ fontSize: '9px' }}>{rate}%</span>
                      </td>
                      <td className="text-right text-muted mono" style={{ paddingRight: '24px' }}>{metric.avgLatencyMs || 0} ms</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={5} className="text-center text-muted" style={{ padding: '24px' }}>No provider metrics available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-24">
          {/* Lockouts */}
          <div className="dash-card mb-0">
            <div className="dash-card-title">Active lockouts</div>
            <div className="flex flex-col gap-8">
              {lockoutRows.length > 0 ? lockoutRows.map(([provider, lockout]) => (
                <div key={provider} style={{ border: '1px solid #f59e0b', background: 'rgba(245, 158, 11, 0.05)', padding: '12px' }}>
                  <div className="flex-between">
                    <span className="font-600 mono">{provider}</span>
                    <span className="badge badge-warning">locked</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text)', marginTop: '6px' }}>Reason: {lockout.reason || 'No reason provided'}</div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>
                    Until: {lockout.until ? formatRelativeTime(lockout.until) : 'indefinite'}
                  </div>
                </div>
              )) : (
                <div className="text-muted text-11 mono">No active provider lockouts.</div>
              )}
            </div>
          </div>

          {/* Hot sessions */}
          <div className="dash-card mb-0">
            <div className="dash-card-title">Busy active sessions</div>
            <div className="flex flex-col gap-8">
              {Array.isArray(sessions.top) && sessions.top.length > 0 ? sessions.top.slice(0, 4).map((session) => (
                <div key={session.sessionId} className="text-11" style={{ border: '1px solid var(--border)', padding: '10px', background: 'var(--surface)' }}>
                  <div className="flex-between mb-8">
                    <span className="text-10 text-muted mono truncate" style={{ maxWidth: '140px' }}>
                      {session.sessionId}
                    </span>
                    <span className="badge badge-success" style={{ fontSize: '8px' }}>{session.requestCount || 0} reqs</span>
                  </div>
                  <div className="text-muted text-10 mono">
                    Idle: {Math.round((session.idleMs || 0) / 1000)}s · Conn: {session.connectionId ? session.connectionId.slice(0, 8) : '—'}
                  </div>
                </div>
              )) : (
                <div className="text-muted text-11 mono">No active sessions in query queue.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

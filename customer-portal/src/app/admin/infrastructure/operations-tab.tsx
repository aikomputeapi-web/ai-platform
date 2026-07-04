'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type ProviderBreaker = {
  state?: string;
  failures?: number;
  retryAfterMs?: number;
  lastFailure?: string | null;
};

type OperationsHealth = {
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

type OperationsData = {
  health: OperationsHealth | null;
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

  const breakerEntries = useMemo(() => Object.entries(data?.health?.providerHealth || {}), [data]);
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
      <div className="flex-center justify-center" style={{ minHeight: '400px' }}>
        <div className="text-center mono" style={{ border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '24px' }}>
          <h2 className="font-700 mb-8" style={{ fontSize: '16px' }}>Operations failed to load</h2>
          <p className="text-12 text-muted mb-16">{error}</p>
          <button type="button" onClick={() => void fetchData()} className="btn-border" style={{ padding: '6px 12px' }}>
            Retry Operations
          </button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex-center justify-center" style={{ minHeight: '400px' }}>
        <div className="auth-spinner" />
      </div>
    );
  }

  const health: Partial<OperationsHealth> = data.health ?? {};
  const system = health.system || {};
  const providerSummary = health.providerSummary || {};
  const sessions = health.sessions || {};
  const quota = health.quotaMonitor || {};
  const statusHealthy = String(health.status || '').toLowerCase() === 'healthy';

  return (
    <div>
      {/* Header */}
      <div className="dash-page-header flex items-end flex-wrap gap-20 justify-between">
        <div>
          <h1 className="dash-page-title">Live Platform Telemetry</h1>
          <p className="dash-page-sub">
            Realtime OmniRoute status logs, circuit breaker conditions, memory limits, and provider failover signals.
          </p>
        </div>
        <div className="flex gap-8">
          <button
            onClick={() => void fetchData()}
            className="btn-border mono inline-flex items-center gap-6"
            style={{ padding: '6px 12px', fontSize: '11px' }}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
          <button
            onClick={() => void resetCircuitBreakers()}
            className="btn-border mono"
            style={{ padding: '6px 12px', fontSize: '11px', color: '#ef4444', borderColor: '#ef4444' }}
            disabled={actionLoading}
          >
            Reset Breakers
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="dash-stats-grid mb-24" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {[
          { label: 'System status', value: statusHealthy ? 'Healthy' : 'Degraded', sub: health.status || 'unknown', color: statusHealthy ? 'var(--accent)' : '#f59e0b' },
          { label: 'Configured Providers', value: String(providerSummary.configuredCount ?? breakerEntries.length), sub: `${providerSummary.activeCount ?? 0} active in loop`, color: 'var(--text)' },
          { label: 'Active Sessions', value: String(sessions.activeCount ?? 0), sub: `${sessions.stickyBoundCount ?? 0} sticky bound`, color: 'var(--muted)' },
          { label: 'Alert Signals', value: String((quota.alerting || 0) + unhealthyBreakers.length + degradedFeatures.length), sub: `${quota.exhausted || 0} exhausted quota`, color: '#ef4444' },
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

      {/* Grid Layout for details */}
      <div className="dash-grid-2 mb-24">
        <div className="dash-card mb-0">
          <div className="dash-card-title flex-between">
            <span>Runtime Engine Health</span>
            <span className={`badge ${statusHealthy ? 'badge-success' : 'badge-warning'}`}>
              {statusHealthy ? 'operational' : 'attention required'}
            </span>
          </div>
          <div className="dash-params-grid">
            <div className="dash-param">
              <div className="dash-param-label">Uptime</div>
              <div className="dash-param-value">{formatUptime(system.uptime)}</div>
              <div className="mono text-muted mt-4" style={{ fontSize: '9px' }}>
                v{system.version || '—'} · Node {system.nodeVersion || '—'}
              </div>
            </div>
            <div className="dash-param">
              <div className="dash-param-label">RSS size</div>
              <div className="dash-param-value">{formatBytes(system.memoryUsage?.rss)}</div>
              <div className="mono text-muted mt-4" style={{ fontSize: '9px' }}>
                Heap: {formatBytes(system.memoryUsage?.heapUsed)}
              </div>
            </div>
            <div className="dash-param">
              <div className="dash-param-label">Breakers Registry</div>
              <div className="dash-param-value">{breakerEntries.length}</div>
              <div className="mono text-muted mt-4" style={{ fontSize: '9px' }}>
                {unhealthyBreakers.length} flagged down
              </div>
            </div>
          </div>
        </div>

        <div className="dash-card mb-0">
          <div className="dash-card-title">Routing Load Pressure</div>
          <div className="dash-params-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="dash-param">
              <div className="dash-param-label">In-flight Requests</div>
              <div className="dash-param-value">{health.inflightRequests ?? 0}</div>
            </div>
            <div className="dash-param">
              <div className="dash-param-label">Active Limiters</div>
              <div className="dash-param-value">{Object.keys(health.rateLimitStatus || {}).length}</div>
            </div>
            <div className="dash-param">
              <div className="dash-param-label">Quota Alerting</div>
              <div className="dash-param-value">{quota.alerting ?? 0}</div>
            </div>
            <div className="dash-param">
              <div className="dash-param-label">Backoff holds</div>
              <div className="dash-param-value">{quota.backoff ?? 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Breaker States & Provider performance */}
      <div className="dash-grid-2 mb-24">
        <div className="dash-card mb-0">
          <div className="dash-card-title flex-between">
            <span>Circuit Breakers</span>
            <span className="badge badge-accent">{breakerEntries.length} providers</span>
          </div>

          <div className="flex flex-col gap-16">
            {unhealthyBreakers.length > 0 && (
              <div className="flex flex-col gap-8">
                <span className="mono text-10 text-muted uppercase">Breaker Hold Alert</span>
                {unhealthyBreakers.map(([provider, breaker]) => {
                  const style = CB_STYLES[breaker.state || 'OPEN'] || CB_STYLES.OPEN;
                  return (
                    <div key={provider} style={{ border: '1px solid', padding: '12px', ...style.tone }}>
                      <div className="flex-between">
                        <strong className="mono">{provider}</strong>
                        <span className={`badge ${style.badge}`}>{style.label}</span>
                      </div>
                      <div className="mt-6" style={{ fontSize: '11px' }}>
                        {breaker.failures || 0} consecutive failures · retry window: {breaker.retryAfterMs ? `${Math.round((breaker.retryAfterMs || 0) / 1000)}s` : '—'}
                      </div>
                      <div className="mt-4" style={{ fontSize: '10px', opacity: 0.8 }}>
                        Last logged down: {formatRelativeTime(breaker.lastFailure)} ago
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <span className="block mono text-10 text-muted uppercase mb-8">Operational Providers</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
                {healthyBreakers.length > 0 ? healthyBreakers.map(([provider]) => (
                  <div key={provider} className="border-default bg-surface text-11 font-600" style={{ padding: '8px 12px' }}>
                    {provider}
                  </div>
                )) : (
                  <div className="text-muted text-11 mono">No operational providers active.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="dash-card mb-0 p-0 overflow-hidden">
          <div className="dash-card-title flex-between" style={{ padding: '24px 24px 0 24px' }}>
            <span>Provider Performance telemetry</span>
            <span className="badge badge-accent">hottest 8</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
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
                    <td colSpan={5} className="text-center text-muted" style={{ padding: '24px' }}>No provider statistics.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Degradation / Alert Center */}
      <div className="dash-card mb-24">
        <div className="dash-card-title flex-between">
          <span>System Alerts Summary</span>
          <span className={`badge ${degradation?.isDegraded ? 'badge-warning' : 'badge-success'}`}>
            {degradation?.isDegraded ? 'active alerts' : 'clear'}
          </span>
        </div>

        <div className="dash-grid-3">
          <div className="border-default p-16 bg-surface">
            <div className="mono text-10 text-muted uppercase mb-8">Degradation level totals</div>
            <div className="mono text-11" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="border-bottom" style={{ paddingBottom: '4px' }}>Full: <strong className="text-accent">{degradation?.summary?.full ?? 0}</strong></div>
              <div className="border-bottom" style={{ paddingBottom: '4px' }}>Reduced: <strong style={{ color: '#f59e0b' }}>{degradation?.summary?.reduced ?? 0}</strong></div>
              <div className="border-bottom" style={{ paddingBottom: '4px' }}>Minimal: <strong style={{ color: '#f97316' }}>{degradation?.summary?.minimal ?? 0}</strong></div>
              <div>Default: <strong style={{ color: '#ef4444' }}>{degradation?.summary?.default ?? 0}</strong></div>
            </div>
          </div>

          <div className="border-default p-16 bg-surface">
            <div className="mono text-10 text-muted uppercase mb-8">Degraded Features queue</div>
            <div className="flex flex-col gap-6">
              {degradedFeatures.length > 0 ? degradedFeatures.slice(0, 3).map((entry) => (
                <div key={entry.feature} className="border-default bg-bg p-8 text-11">
                  <div className="flex-between">
                    <span className="font-600">{entry.feature}</span>
                    <span className="badge badge-warning" style={{ fontSize: '8px' }}>{entry.level}</span>
                  </div>
                  <div className="text-muted mt-4" style={{ fontSize: '9px' }}>{entry.capability}</div>
                </div>
              )) : (
                <div className="text-muted text-11 mono">No features degraded.</div>
              )}
            </div>
          </div>

          <div className="border-default p-16 bg-surface">
            <div className="mono text-10 text-muted uppercase mb-8">Active Limit rules</div>
            <div className="flex flex-col gap-4 text-12">
              <div className="flex-between border-bottom" style={{ paddingBottom: '4px' }}>
                <span className="text-muted">Active Lockouts</span>
                <span className="font-600 mono">{Object.keys(health.lockouts || {}).length}</span>
              </div>
              <div className="flex-between border-bottom" style={{ paddingBottom: '4px' }}>
                <span className="text-muted">Rate Limit states</span>
                <span className="font-600 mono">{Object.keys(health.rateLimitStatus || {}).length}</span>
              </div>
              <div className="flex-between">
                <span className="text-muted">Quota Monitors active</span>
                <span className="font-600 mono">{quota.active ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Session pressure details */}
      <div className="dash-card">
        <div className="dash-card-title flex-between">
          <span>Active Session Telemetry</span>
          <span className="badge badge-accent">Live routing signals</span>
        </div>
        {Array.isArray(sessions.top) && sessions.top.length > 0 ? (
          <div className="dash-grid-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {sessions.top.slice(0, 6).map((session) => (
              <div key={session.sessionId} className="border-default p-12 bg-surface">
                <div className="flex-between mb-8">
                  <span className="mono text-10 text-muted truncate" style={{ maxWidth: '120px' }}>
                    {session.sessionId}
                  </span>
                  <span className="badge badge-success" style={{ fontSize: '8px' }}>{session.requestCount || 0} reqs</span>
                </div>
                <div className="text-11 text-bright">
                  {session.connectionId ? `Connection: ${session.connectionId.slice(0, 8)}` : 'no-conn-id'}
                </div>
                <div className="mono text-10 text-muted mt-4">
                  Idle: {Math.round((session.idleMs || 0) / 1000)}s · age: {Math.round((session.ageMs || 0) / 1000)}s
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted text-12 mono">No active route connections currently tracked.</div>
        )}
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type TrendPoint = {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
};

type UserUsage = {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  isLocked?: boolean;
  plan: { id: string; name: string; priceCents: number };
  createdAt: string;
  apiKeys: { id: string; name: string; lastFour: string | null; isActive: boolean; createdAt: string }[];
  usage: {
    totalTokens: number;
    totalRequests: number;
    totalCost: number;
    promptTokens: number;
    completionTokens: number;
    topModels: { model: string; requests: number }[];
  };
  totalPaidCents: number;
};

type UsageAnalytics = {
  summary: {
    totalUsers: number;
    verifiedUsers: number;
    totalApiKeys: number;
    activeApiKeys: number;
    totalRevenueCents: number;
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    planBreakdown: { id: string; name: string; priceCents: number; userCount: number }[];
  };
  users: UserUsage[];
  globalAnalytics: { dailyTrend: TrendPoint[]; byModel: { model: string; requests: number }[] };
  range: string;
};

const RANGE_OPTIONS = ['7d', '30d', '90d', 'all'] as const;

function TrendSparkline({
  points,
  color,
  height = 120,
}: {
  points: { label: string; value: number }[];
  color: string;
  height?: number;
}) {
  const values = points.map((point) => point.value);
  const max = Math.max(...values, 1);
  const width = 560;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points.map((point, index) => {
    const x = index * step;
    const y = height - (point.value / max) * (height - 14);
    return `${x},${y}`;
  });
  const area = `0,${height} ${coords.join(' ')} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="block" style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id={`usage-gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#usage-gradient-${color.replace('#', '')})`} />
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatCount(value: number) {
  return value.toLocaleString();
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${value.toFixed(0)}`;
}

export default function UsageAdminPage() {
  const [data, setData] = useState<UsageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]>('all');

  const fetchData = useCallback(async (selectedRange: (typeof RANGE_OPTIONS)[number] = range) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?range=${selectedRange}`);
      if (!res.ok) {
        setError('Failed to load usage');
        return;
      }
      setData(await res.json());
      setError('');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [range]);

  const fmtUSD = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const fmt = (n: number) => n.toLocaleString();

  const recentTrend = useMemo(() => data?.globalAnalytics.dailyTrend.slice(-14) || [], [data]);
  const trendRequests = recentTrend.map((day) => ({ label: day.date, value: day.requests }));
  const trendTokens = recentTrend.map((day) => ({ label: day.date, value: day.tokens }));
  const topUsers = useMemo(
    () =>
      [...(data?.users || [])]
        .sort((a, b) => b.usage.totalRequests - a.usage.totalRequests)
        .slice(0, 10),
    [data]
  );
  const topModels = useMemo(() => [...(data?.globalAnalytics.byModel || [])].slice(0, 8), [data]);
  const planBreakdown = data?.summary.planBreakdown || [];
  const totalRequests = data?.summary.totalRequests || 0;
  const topFiveShare = topUsers.slice(0, 5).reduce((sum, user) => sum + (totalRequests > 0 ? user.usage.totalRequests / totalRequests : 0), 0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData(range);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [range, fetchData]);

  if (loading || !data) {
    return (
      <div className="loading-box">
        <div className="auth-spinner" />
      </div>
    );
  }

  const summary = data.summary;

  return (
    <div>
      <div className="dash-page-header flex flex-wrap items-end justify-between gap-20">
        <div>
          <h1 className="dash-page-title">Platform Usage Analytics</h1>
          <p className="dash-page-sub">
            See requests, tokens, and spend across the whole platform.
          </p>
        </div>
        <div className="flex gap-8">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => {
                setRange(option);
                void fetchData(option);
              }}
              className="btn-border text-11 mono"
              style={{
                padding: '6px 12px',
                background: range === option ? 'var(--accent)' : 'transparent',
                color: range === option ? 'var(--bg)' : 'var(--text)',
                borderColor: range === option ? 'var(--accent)' : 'var(--border-bright)'
              }}
            >
              {option.toUpperCase()}
            </button>
          ))}
          <button
            onClick={() => void fetchData()}
            className="btn-border text-11 mono"
            style={{
              padding: '6px 12px',
              background: 'transparent',
              color: 'var(--text)',
              borderColor: 'var(--border-bright)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="error-box">
          Error: {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="dash-stats-grid mb-24" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {[
          { label: 'Requests', value: formatCompact(summary.totalRequests), sub: `${data.range.toUpperCase()} window`, color: 'var(--text)' },
          { label: 'Tokens', value: formatCompact(summary.totalTokens), sub: 'prompt + completion', color: 'var(--muted)' },
          { label: 'Estimated Cost', value: formatMoney(summary.totalCost), sub: 'provider spend signal', color: 'var(--accent)' },
          { label: 'Top 5 Share', value: `${Math.round(topFiveShare * 100)}%`, sub: 'request concentration', color: 'var(--accent)' },
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

      {/* Grid: Request Trend & Plan Mix */}
      <div className="dash-grid-2 mb-24">
        <div className="dash-card" style={{ marginBottom: 0 }}>
          <div className="dash-card-title flex-between">
            <span>Request Trend</span>
            <span className="badge badge-accent">LIVE</span>
          </div>
          {recentTrend.length > 0 ? (
            <div>
              <div className="mb-16" style={{ border: '1px solid var(--border)', padding: '16px', background: 'var(--bg)' }}>
                <TrendSparkline points={trendRequests} color="var(--accent)" height={150} />
              </div>
              <div className="dash-params-grid">
                <div className="dash-param">
                  <div className="dash-param-label">14d requests</div>
                  <div className="dash-param-value">{fmt(recentTrend.reduce((sum, day) => sum + day.requests, 0))}</div>
                </div>
                <div className="dash-param">
                  <div className="dash-param-label">14d tokens</div>
                  <div className="dash-param-value">{fmt(recentTrend.reduce((sum, day) => sum + day.tokens, 0))}</div>
                </div>
                <div className="dash-param">
                  <div className="dash-param-label">14d cost</div>
                  <div className="dash-param-value">{formatMoney(recentTrend.reduce((sum, day) => sum + day.cost, 0))}</div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-12 mono text-muted">No usage trend data is available yet.</p>
          )}
        </div>

        <div className="dash-card" style={{ marginBottom: 0 }}>
          <div className="dash-card-title">Plan Mix</div>
          <div className="dash-stack" style={{ gap: '10px' }}>
            {planBreakdown.map((plan) => (
              <div key={plan.id} className="card" style={{ padding: '12px' }}>
                <div className="flex-between mb-8">
                  <span className="font-600 text-13">{plan.name}</span>
                  <span className="badge badge-accent">{fmt(plan.userCount)} users</span>
                </div>
                <div className="footnote">
                  Price: {fmtUSD(plan.priceCents)} / month
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid: Top Accounts & Top Models */}
      <div className="dash-grid-2 mb-24">
        <div className="dash-card" style={{ marginBottom: 0, overflowX: 'auto' }}>
          <div className="dash-card-title flex-between">
            <span>Top Accounts (Selected Range)</span>
            <Link href="/admin/customers" className="dash-logout" style={{ textDecoration: 'none' }}>Full Table →</Link>
          </div>
          <table className="dash-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Plan</th>
                <th className="text-right">Requests</th>
                <th className="text-right">Tokens</th>
                <th className="text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.length > 0 ? topUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div style={{ minWidth: 0 }}>
                      <div className="font-600 text-12" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{user.name || '—'}</div>
                      <div className="text-muted" style={{ fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{user.email}</div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${user.plan.id === 'free' ? 'badge-warning' : user.plan.id === 'pro' ? 'badge-accent' : 'badge-success'}`}>{user.plan.name}</span>
                  </td>
                  <td className="text-right mono">{formatCount(user.usage.totalRequests)}</td>
                  <td className="text-right mono">{formatCount(user.usage.totalTokens)}</td>
                  <td className="text-right mono font-600">{formatMoney(user.usage.totalCost)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="text-center text-muted" style={{ padding: '24px' }}>No usage data available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="dash-card" style={{ marginBottom: 0 }}>
          <div className="dash-card-title">Top Models by Request Volume</div>
          <div className="dash-stack" style={{ gap: '8px' }}>
            {topModels.map((model, index) => (
              <div key={model.model} className="card" style={{ padding: '10px 12px' }}>
                <div className="flex-between" style={{ marginBottom: '6px' }}>
                  <span className="font-600 mono text-11">{model.model}</span>
                  <span className="footnote">{fmt(model.requests)} reqs</span>
                </div>
                <div style={{ height: '4px', background: 'var(--border-bright)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: 'var(--accent)',
                      width: `${Math.max(4, (model.requests / Math.max(topModels[0]?.requests || 1, 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Token Trend */}
      <div className="dash-card">
        <div className="dash-card-title flex-between">
          <span>Token Trend (14d)</span>
          <span className="badge badge-accent">Live telemetry</span>
        </div>
        {recentTrend.length > 0 ? (
          <div style={{ border: '1px solid var(--border)', padding: '16px', background: 'var(--bg)' }}>
            <TrendSparkline points={trendTokens} color="var(--muted)" height={120} />
          </div>
        ) : (
          <p className="text-12 mono text-muted">No token trend data is available yet.</p>
        )}
      </div>
    </div>
  );
}

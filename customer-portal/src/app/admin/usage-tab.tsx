'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, RefreshCw, Users } from 'lucide-react';

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
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <defs>
        <linearGradient id={`usage-gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#usage-gradient-${color.replace('#', '')})`} />
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
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
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading usage…</p>
        </div>
      </div>
    );
  }

  const summary = data.summary;

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <div className="glass-card p-6 mb-8 border border-[var(--color-border)] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at top right, rgba(255,255,255,0.03), transparent 45%)' }} />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-accent-subtle)] text-white text-xs font-semibold uppercase tracking-wider mb-4 border border-[var(--color-border)]">
                Platform Usage
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05] mb-3">
                See requests, tokens, and spend across the whole platform.
              </h1>
              <p className="text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
                This page is the owner-facing usage surface for customer demand, model mix, plan distribution, and concentration risk.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setRange(option);
                    void fetchData(option);
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all cursor-pointer ${
                    range === option
                      ? 'bg-white text-black border-white'
                      : 'bg-transparent text-[var(--color-text-secondary)] hover:text-white border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]'
                  }`}
                >
                  {option.toUpperCase()}
                </button>
              ))}
              <button
                onClick={() => void fetchData()}
                className="px-3 py-1.5 rounded text-xs font-semibold border border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-card-hover)] transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
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
            { label: 'Requests', value: formatCompact(summary.totalRequests), sub: `${data.range.toUpperCase()} window`, color: '#ffffff' },
            { label: 'Tokens', value: formatCompact(summary.totalTokens), sub: 'prompt + completion', color: '#a1a1aa' },
            { label: 'Estimated Cost', value: formatMoney(summary.totalCost), sub: 'provider spend signal', color: '#71717a' },
            { label: 'Top 5 Share', value: `${Math.round(topFiveShare * 100)}%`, sub: 'request concentration', color: '#d4d4d8' },
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

        <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-6 mb-8">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold">Request Trend</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Two-week request and token movement.</p>
              </div>
              <span className="badge-accent">LIVE</span>
            </div>
            {recentTrend.length > 0 ? (
              <>
                <TrendSparkline points={trendRequests} color="#ffffff" height={150} />
                <div className="grid sm:grid-cols-3 gap-3 mt-5">
                  <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-primary)' }}>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">14-day requests</div>
                    <div className="text-lg font-semibold">{fmt(recentTrend.reduce((sum, day) => sum + day.requests, 0))}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">combined platform usage</div>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-primary)' }}>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">14-day tokens</div>
                    <div className="text-lg font-semibold">{fmt(recentTrend.reduce((sum, day) => sum + day.tokens, 0))}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">prompt + completion</div>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-primary)' }}>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">14-day cost</div>
                    <div className="text-lg font-semibold">{formatMoney(recentTrend.reduce((sum, day) => sum + day.cost, 0))}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">estimated provider spend</div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">No usage trend data is available yet.</p>
            )}
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold">Plan Mix</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Customer counts and revenue distribution by tier.</p>
              </div>
              <Users size={16} className="text-[var(--color-accent)]" />
            </div>
            <div className="space-y-3">
              {planBreakdown.map((plan, index) => (
                <div key={plan.id} className="rounded-xl p-4 border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="font-semibold">{plan.name}</div>
                    <span className="badge-accent text-[10px]">#{index + 1}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg p-3 bg-[var(--color-bg-primary)]">
                      <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Users</div>
                      <div className="text-lg font-semibold mt-1">{fmt(plan.userCount)}</div>
                    </div>
                    <div className="rounded-lg p-3 bg-[var(--color-bg-primary)]">
                      <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Price</div>
                      <div className="text-lg font-semibold mt-1">{fmtUSD(plan.priceCents)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-6 mb-8">
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Top Accounts</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Highest usage customers in the selected range.</p>
              </div>
              <Link href="/admin/customers" className="text-sm text-[var(--color-accent)] hover:underline inline-flex items-center gap-1">
                Full account table <ArrowRight size={14} />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wider" style={{ background: 'var(--color-bg-secondary)' }}>
                    <th className="px-6 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Plan</th>
                    <th className="px-4 py-3 font-semibold text-right">Requests</th>
                    <th className="px-4 py-3 font-semibold text-right">Tokens</th>
                    <th className="px-4 py-3 font-semibold text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {topUsers.length > 0 ? topUsers.map((user) => (
                    <tr key={user.id} className="border-t border-[rgba(255,255,255,0.03)] hover:bg-[var(--color-bg-card)] transition-colors">
                      <td className="px-6 py-4">
                        <div className="min-w-0">
                          <div className="font-medium truncate max-w-[240px]">{user.name || '—'}</div>
                          <div className="text-xs text-[var(--color-text-muted)] truncate max-w-[240px]">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`badge-${user.plan.id === 'free' ? 'warning' : user.plan.id === 'pro' ? 'accent' : 'success'}`}>{user.plan.name}</span>
                      </td>
                      <td className="px-4 py-4 text-right font-mono">{formatCount(user.usage.totalRequests)}</td>
                      <td className="px-4 py-4 text-right font-mono">{formatCount(user.usage.totalTokens)}</td>
                      <td className="px-4 py-4 text-right font-mono">{formatMoney(user.usage.totalCost)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-[var(--color-text-muted)]">No usage data available yet.</td>
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
                  <h2 className="text-lg font-semibold">Top Models</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">Request share across the current model mix.</p>
                </div>
              </div>
              <div className="space-y-2">
                {topModels.map((model, index) => (
                  <div key={model.model} className="rounded-lg px-3 py-2" style={{ background: index === 0 ? 'var(--color-accent-subtle)' : 'var(--color-bg-primary)' }}>
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="text-sm font-medium truncate">{model.model}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{fmt(model.requests)} reqs</div>
                    </div>
                    <div className="h-2 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(4, (model.requests / Math.max(topModels[0]?.requests || 1, 1)) * 100)}%`,
                          background: '#ffffff',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Token Trend</h2>
              <p className="text-sm text-[var(--color-text-muted)]">A second signal for usage intensity over the same time range.</p>
            </div>
            <span className="badge-accent">LIVE ANALYTICS</span>
          </div>
          {recentTrend.length > 0 ? (
            <TrendSparkline points={trendTokens} color="#a1a1aa" height={150} />
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No token trend data is available yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

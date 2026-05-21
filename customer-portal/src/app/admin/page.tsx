'use client';

import Link from 'next/link';
import { useCallback, useState, useEffect } from 'react';

interface UserData {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  plan: { id: string; name: string; priceCents: number; requestsPerDay: number; requestsPerMonth: number };
  createdAt: string;
  apiKeys: { id: string; name: string; lastFour: string | null; isActive: boolean; createdAt: string }[];
  payments: { id: string; amountCents: number; status: string; createdAt: string }[];
  usage: {
    totalTokens: number;
    totalRequests: number;
    totalCost: number;
    promptTokens: number;
    completionTokens: number;
    topModels: { model: string; requests: number }[];
  };
  totalPaidCents: number;
}

interface Summary {
  totalUsers: number;
  verifiedUsers: number;
  totalApiKeys: number;
  activeApiKeys: number;
  totalRevenueCents: number;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  matchedRequests?: number;
  matchedTokens?: number;
  matchedCost?: number;
  unmatchedRequests?: number;
  unmatchedTokens?: number;
  unmatchedCost?: number;
  coveragePct?: number;
  planBreakdown: { id: string; name: string; priceCents: number; userCount: number }[];
}

interface TrendPoint {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
}

interface ModelUsage {
  model: string;
  requests: number;
}

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
        <linearGradient id={`trend-gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#trend-gradient-${color.replace('#', '')})`} />
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((point, index) => (
        <g key={point.label}>
          <circle
            cx={index * step}
            cy={height - (point.value / max) * (height - 14)}
            r="2.5"
            fill={color}
          />
        </g>
      ))}
    </svg>
  );
}

interface AdminData {
  summary: Summary;
  users: UserData[];
  globalAnalytics: { dailyTrend: TrendPoint[]; byModel: ModelUsage[] };
  range: string;
}

const RANGE_OPTIONS = ['7d', '30d', '90d', 'all'] as const;

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]>('all');
  const [now] = useState(() => Date.now());

  const fetchData = useCallback(async (selectedRange: (typeof RANGE_OPTIONS)[number] = range) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?range=${selectedRange}`);
      if (!res.ok) {
        setError('Failed to load overview');
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

  // Load data on mount and when range changes
  useEffect(() => {
    void fetchData(range);
  }, [range, fetchData]);

  const fmt = (n: number) => n.toLocaleString();
  const fmtUSD = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const fmtTokens = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;
  const timeAgo = (d: string) => {
    const s = Math.floor((now - new Date(d).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  if (loading || !data) {
    return (
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading control center…</p>
        </div>
      </div>
    );
  }

  const s = data.summary;
  const totalPaidAccounts = data.users.filter(u => u.totalPaidCents > 0).length;
  const unverifiedUsers = data.users.filter(u => !u.emailVerified).length;
  const keylessUsers = data.users.filter(u => !u.apiKeys.length).length;
  const topModels = (data.globalAnalytics.byModel || []).slice(0, 5);
  const recentUsers = data.users.slice(0, 6);
  const focusUsers = data.users.filter(u => !u.emailVerified || !u.apiKeys.length || u.usage.totalRequests > 100).slice(0, 5);
  const recentTrend = data.globalAnalytics.dailyTrend.slice(-14);
  const trendRequests = recentTrend.map((day) => ({ label: day.date, value: day.requests }));
  const trendCost = recentTrend.map((day) => ({ label: day.date, value: day.cost }));
  const peakTrendDay = recentTrend.reduce<TrendPoint | null>((best, day) => (!best || day.requests > best.requests ? day : best), null);
  const totalModelRequests = topModels.reduce((sum, model) => sum + (model.requests || 0), 0);
  const coveragePct = typeof s.coveragePct === 'number' ? s.coveragePct : (s.totalRequests > 0 ? 0 : 100);
  const modelEconomics = topModels.map((model) => {
    const share = s.totalRequests > 0 ? model.requests / s.totalRequests : 0;
    return {
      model: model.model,
      requests: model.requests,
      share,
      estimatedCost: s.totalCost * share,
    };
  });

  const cards = [
    { label: 'Users', value: fmt(s.totalUsers), sub: `${fmt(s.verifiedUsers)} verified`, color: '#6366f1' },
    { label: 'Revenue', value: fmtUSD(s.totalRevenueCents), sub: `${totalPaidAccounts} paying accounts`, color: '#10b981' },
    { label: 'Requests', value: fmtTokens(s.totalRequests), sub: `range: ${data.range.toUpperCase()}`, color: '#8b5cf6' },
    { label: 'Tokens', value: fmtTokens(s.totalTokens), sub: `$${s.totalCost.toFixed(2)} estimated cost`, color: '#ef4444' },
    { label: 'API Keys', value: fmt(s.totalApiKeys), sub: `${fmt(s.activeApiKeys)} active`, color: '#f59e0b' },
    { label: 'Coverage', value: `${coveragePct}%`, sub: `${fmt(s.matchedRequests || 0)} matched · ${fmt(s.unmatchedRequests || 0)} unmatched`, color: '#22c55e' },
  ];

  return (
    <div className="min-h-[calc(100vh-44px)]" style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="glass-card p-6 mb-8 border border-[rgba(99,102,241,0.18)] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at top right, rgba(99,102,241,0.22), transparent 35%)' }} />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] text-xs font-semibold uppercase tracking-wider mb-4 border border-[rgba(99,102,241,0.2)]">
                Central Control Center
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05] mb-3">
                Manage the website like a product operator.
              </h1>
              <p className="text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
                This dashboard is the owner-facing command center for the customer panel, billing, model registry, and platform health.
                Use it to find accounts, inspect usage, review billing, and watch growth in one place.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {RANGE_OPTIONS.map(r => (
                <button
                  key={r}
                  onClick={() => {
                    setRange(r);
                    void fetchData(r);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${range === r ? 'text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}
                  style={range === r ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' } : { background: 'var(--color-bg-card)' }}
                >
                  {r.toUpperCase()}
                </button>
              ))}
              <Link href="/admin/users" className="btn-secondary text-xs py-1.5 px-3">Account Table</Link>
              <Link href="/admin/billing" className="btn-secondary text-xs py-1.5 px-3">Billing</Link>
              <Link href="/admin/usage" className="btn-secondary text-xs py-1.5 px-3">Usage</Link>
              <Link href="/admin/reports" className="btn-secondary text-xs py-1.5 px-3">Reports</Link>
              <Link href="/admin/plans" className="btn-secondary text-xs py-1.5 px-3">Plans</Link>
              <Link href="/admin/support" className="btn-secondary text-xs py-1.5 px-3">Support</Link>
              <Link href="/admin/audit-log" className="btn-secondary text-xs py-1.5 px-3">Activity</Link>
              <Link href="/admin/models" className="btn-secondary text-xs py-1.5 px-3">Model Registry</Link>
              <Link href="/admin/routing" className="btn-secondary text-xs py-1.5 px-3">Routing</Link>
              <Link href="/admin/forecast" className="btn-secondary text-xs py-1.5 px-3">Forecasts</Link>
              <Link href="/admin/operations" className="btn-secondary text-xs py-1.5 px-3">Operations</Link>
              <Link href="/admin/settings" className="btn-secondary text-xs py-1.5 px-3">Settings</Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {cards.map((card, i) => (
            <div key={card.label} className="stat-card" style={{ animationDelay: `${i * 0.04}s` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--color-text-muted)] text-xs font-medium">{card.label}</span>
                <span className="text-base" style={{ color: card.color }}>●</span>
              </div>
              <div className="stat-value text-2xl">{card.value}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">{card.sub}</div>
            </div>
          ))}
        </div>

        {typeof s.unmatchedRequests === 'number' && s.unmatchedRequests > 0 && (
          <div className="mb-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="font-semibold">Analytics gap detected.</span>{' '}
              {fmt(s.unmatchedRequests)} requests and {fmtTokens(s.unmatchedTokens || 0)} tokens are not yet tied to portal accounts.
            </div>
            <div className="text-xs uppercase tracking-wider text-amber-200/80">
              Coverage {coveragePct}%
            </div>
          </div>
        )}

        <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-6 mb-8">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold">Usage Trend</h2>
                <p className="text-sm text-[var(--color-text-muted)]">The latest two weeks of requests and cost activity.</p>
              </div>
              <span className="badge-accent">LIVE ANALYTICS</span>
            </div>
            {recentTrend.length > 0 ? (
              <>
                <TrendSparkline points={trendRequests} color="#6366f1" height={150} />
                <div className="grid sm:grid-cols-3 gap-3 mt-5">
                  <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-primary)' }}>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Peak day</div>
                    <div className="text-lg font-semibold">{peakTrendDay?.date || '—'}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">{peakTrendDay ? fmt(peakTrendDay.requests) : 'No trend data' } requests</div>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-primary)' }}>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">14-day requests</div>
                    <div className="text-lg font-semibold">{fmt(recentTrend.reduce((sum, day) => sum + day.requests, 0))}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">combined platform requests</div>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-primary)' }}>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">14-day cost</div>
                    <div className="text-lg font-semibold">{fmtUSD(Math.round(recentTrend.reduce((sum, day) => sum + day.cost, 0) * 100))}</div>
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
                <h2 className="text-lg font-semibold">Cost Signal</h2>
                <p className="text-sm text-[var(--color-text-muted)]">A quick view of recent spend volatility.</p>
              </div>
              <Link href="/admin/forecast" className="text-sm text-[var(--color-accent)] hover:underline">Open forecast</Link>
            </div>
            {recentTrend.length > 0 ? (
              <>
                <TrendSparkline points={trendCost} color="#ef4444" height={150} />
                <div className="mt-5 space-y-2">
                  {recentTrend.slice(-5).map((day) => (
                    <div key={day.date} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--color-bg-primary)' }}>
                      <div className="text-xs text-[var(--color-text-muted)]">{day.date}</div>
                      <div className="text-sm font-semibold text-[var(--color-text-secondary)]">{fmtUSD(Math.round(day.cost * 100))}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">No cost data is available yet.</p>
            )}
          </div>
        </div>

        <div className="grid xl:grid-cols-[0.95fr_1.05fr] gap-6 mb-8">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold">Model Economics</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Estimated cost allocation by request share.</p>
              </div>
              <span className="badge-accent">ESTIMATED</span>
            </div>
            <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--color-bg-primary)' }}>
              <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Top model request share</div>
              <div className="text-2xl font-semibold">{totalModelRequests > 0 ? `${Math.round((modelEconomics[0]?.share || 0) * 100)}%` : '—'}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">
                {modelEconomics[0]?.model || 'No model data yet'} is leading the current mix.
              </div>
            </div>
            <div className="space-y-2">
              {modelEconomics.length > 0 ? modelEconomics.map((model, index) => (
                <div key={model.model} className="rounded-lg px-3 py-2 flex items-center justify-between gap-3" style={{ background: index === 0 ? 'var(--color-accent-subtle)' : 'var(--color-bg-primary)' }}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{model.model}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{fmt(model.requests)} requests · {Math.round(model.share * 100)}% share</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{fmtUSD(Math.round(model.estimatedCost))}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">est. cost share</div>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-[var(--color-text-muted)]">No model usage recorded yet.</p>
              )}
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold">Model Drilldown</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Current top models and their request load.</p>
              </div>
              <Link href="/admin/models" className="text-sm text-[var(--color-accent)] hover:underline">Open registry</Link>
            </div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {modelEconomics.length > 0 ? modelEconomics.slice(0, 6).map((model, index) => (
                <div key={model.model} className="rounded-xl p-4 border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="font-semibold text-sm truncate">{model.model}</div>
                    <span className="badge-success">#{index + 1}</span>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">{fmt(model.requests)} requests</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">est. spend {fmtUSD(Math.round(model.estimatedCost))}</div>
                </div>
              )) : (
                <div className="text-sm text-[var(--color-text-muted)]">No model drilldown available yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="grid xl:grid-cols-[1.3fr_0.7fr] gap-6 mb-8">
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Recent Accounts</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Newest users, payment status, and usage snapshot</p>
              </div>
              <Link href="/admin/users" className="text-sm text-[var(--color-accent)] hover:underline">Open full account table</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wider" style={{ background: 'var(--color-bg-secondary)' }}>
                    <th className="px-6 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Plan</th>
                    <th className="px-4 py-3 font-semibold">Joined</th>
                    <th className="px-4 py-3 font-semibold text-right">Requests</th>
                    <th className="px-4 py-3 font-semibold text-right">Keys</th>
                    <th className="px-4 py-3 font-semibold text-right">Paid</th>
                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map(user => (
                    <tr key={user.id} className="border-t border-[rgba(255,255,255,0.03)] hover:bg-[var(--color-bg-card)] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                            {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate max-w-[240px]">{user.name || '—'}</div>
                            <div className="text-xs text-[var(--color-text-muted)] truncate max-w-[240px]">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`badge-${user.plan.id === 'free' ? 'warning' : user.plan.id === 'pro' ? 'accent' : 'success'}`}>{user.plan.name}</span>
                      </td>
                      <td className="px-4 py-4 text-[var(--color-text-muted)]">{timeAgo(user.createdAt)}</td>
                      <td className="px-4 py-4 text-right font-mono font-medium">{fmt(user.usage.totalRequests)}</td>
                      <td className="px-4 py-4 text-right font-mono">{user.apiKeys.length}</td>
                      <td className="px-4 py-4 text-right font-mono" style={{ color: user.totalPaidCents > 0 ? '#10b981' : 'var(--color-text-muted)' }}>
                        {user.totalPaidCents > 0 ? fmtUSD(user.totalPaidCents) : '—'}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {user.emailVerified ? <span className="badge-success">verified</span> : <span className="badge-warning">pending</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-card p-6">
              <h2 className="text-base font-semibold mb-4">Focus List</h2>
              <div className="space-y-3">
                {focusUsers.length > 0 ? focusUsers.map(user => (
                  <div key={user.id} className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{user.name || user.email}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {user.emailVerified ? 'Verified' : 'Needs verification'} · {user.apiKeys.length} keys · {fmt(user.usage.totalRequests)} reqs
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${!user.emailVerified ? 'bg-yellow-500/10 text-yellow-400' : 'bg-slate-500/10 text-slate-300'}`}>
                        Review
                      </span>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-[var(--color-text-muted)]">No accounts need attention right now.</p>
                )}
              </div>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">Top Models</h2>
                <Link href="/admin/models" className="text-xs text-[var(--color-accent)] hover:underline">Open registry</Link>
              </div>
              <div className="space-y-2">
                {topModels.length > 0 ? topModels.map((m: ModelUsage, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: i === 0 ? 'var(--color-accent-subtle)' : 'transparent' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--color-text-muted)] w-5">{i + 1}.</span>
                      <span className="text-sm font-medium font-mono truncate max-w-[180px]">{m.model}</span>
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">{fmt(m.requests || 0)} reqs</span>
                  </div>
                )) : (
                  <p className="text-sm text-[var(--color-text-muted)] italic">No model usage data yet</p>
                )}
              </div>
            </div>

            <div className="glass-card p-6">
              <h2 className="text-base font-semibold mb-4">Owner Shortcuts</h2>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/admin/users" className="btn-secondary text-center py-2">Accounts</Link>
                <Link href="/admin/billing" className="btn-secondary text-center py-2">Billing</Link>
                <Link href="/admin/usage" className="btn-secondary text-center py-2">Usage</Link>
                <Link href="/admin/reports" className="btn-secondary text-center py-2">Reports</Link>
                <Link href="/admin/plans" className="btn-secondary text-center py-2">Plans</Link>
                <Link href="/admin/support" className="btn-secondary text-center py-2">Support</Link>
                <Link href="/admin/forecast" className="btn-secondary text-center py-2">Forecast</Link>
                <Link href="/admin/models" className="btn-secondary text-center py-2">Models</Link>
                <Link href="/admin/routing" className="btn-secondary text-center py-2">Routing</Link>
                <Link href="/admin/audit-log" className="btn-secondary text-center py-2">Activity</Link>
                <Link href="/admin/operations" className="btn-secondary text-center py-2">Operations</Link>
                <Link href="/admin/settings" className="btn-secondary text-center py-2">Settings</Link>
                <Link href="/dashboard" className="btn-secondary text-center py-2">Portal</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

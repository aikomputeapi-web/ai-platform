'use client';

import { Suspense, useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import UsageAdminPage from './usage-tab';
import ForecastPage from './forecast-tab';

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
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id={`trend-gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#trend-gradient-${color.replace('#', '')})`} />
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((point, index) => (
        <g key={point.label}>
          <circle
            cx={index * step}
            cy={height - (point.value / max) * (height - 14)}
            r="2"
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

function AdminOverviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

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
    if (activeTab === 'overview') {
      const timer = window.setTimeout(() => {
        void fetchData(range);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [range, fetchData, activeTab]);

  const handleTabChange = (tabName: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabName);
    router.push(`?${params.toString()}`);
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'usage', label: 'Usage Metrics' },
    { id: 'forecast', label: 'Growth Forecast' }
  ];

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

  // Helper variables for Overview Tab
  const s = data?.summary;
  const totalPaidAccounts = data ? data.users.filter(u => u.totalPaidCents > 0).length : 0;
  const topModels = data ? (data.globalAnalytics.byModel || []).slice(0, 5) : [];
  const recentUsers = data ? data.users.slice(0, 6) : [];
  const focusUsers = data ? data.users.filter(u => !u.emailVerified || !u.apiKeys.length || u.usage.totalRequests > 100).slice(0, 5) : [];
  const recentTrend = data ? data.globalAnalytics.dailyTrend.slice(-14) : [];
  const trendRequests = recentTrend.map((day) => ({ label: day.date, value: day.requests }));
  const trendCost = recentTrend.map((day) => ({ label: day.date, value: day.cost }));
  const peakTrendDay = recentTrend.reduce<TrendPoint | null>((best, day) => (!best || day.requests > best.requests ? day : best), null);
  const totalModelRequests = topModels.reduce((sum, model) => sum + (model.requests || 0), 0);
  const coveragePct = s ? (typeof s.coveragePct === 'number' ? s.coveragePct : (s.totalRequests > 0 ? 0 : 100)) : 100;
  const modelEconomics = s ? topModels.map((model) => {
    const share = s.totalRequests > 0 ? model.requests / s.totalRequests : 0;
    return {
      model: model.model,
      requests: model.requests,
      share,
      estimatedCost: s.totalCost * share,
    };
  }) : [];

  const cards = s ? [
    { label: 'Users', value: fmt(s.totalUsers), sub: `${fmt(s.verifiedUsers)} verified`, color: 'var(--text)' },
    { label: 'Revenue', value: fmtUSD(s.totalRevenueCents), sub: `${totalPaidAccounts} paying accounts`, color: 'var(--accent)' },
    { label: 'Requests', value: fmtTokens(s.totalRequests), sub: `range: ${data?.range.toUpperCase()}`, color: 'var(--text)' },
    { label: 'Tokens', value: fmtTokens(s.totalTokens), sub: `$${s.totalCost.toFixed(2)} estimated cost`, color: 'var(--muted)' },
    { label: 'API Keys', value: fmt(s.totalApiKeys), sub: `${fmt(s.activeApiKeys)} active`, color: 'var(--muted)' },
    { label: 'Coverage', value: `${coveragePct}%`, sub: `${fmt(s.matchedRequests || 0)} matched`, color: 'var(--accent)' },
  ] : [];

  return (
    <div>
      {/* Tab Switcher */}
      <div className="dash-tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`dash-tab ${isActive ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="error-box">
          Error: {error}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'overview' && (
        loading || !data || !s ? (
          <div className="loading-box">
            <div className="auth-spinner" />
          </div>
        ) : (
          <div>
            <div className="dash-page-header flex justify-between items-end flex-wrap gap-20">
              <div>
                <h1 className="dash-page-title">Operational Overview</h1>
                <p className="dash-page-sub">
                  Platform telemetry, developer registration, and revenue tracking control center.
                </p>
              </div>
              <div className="flex gap-8">
                {RANGE_OPTIONS.map(r => (
                  <button
                    key={r}
                    onClick={() => {
                      setRange(r);
                      void fetchData(r);
                    }}
                    className={`btn-border mono text-11${range === r ? ' btn-xs-accent' : ''}`}
                    style={{
                      padding: '6px 12px',
                      background: range === r ? 'var(--accent)' : 'transparent',
                      color: range === r ? 'var(--bg)' : 'var(--text)',
                      borderColor: range === r ? 'var(--accent)' : 'var(--border-bright)'
                    }}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Stat Cards Grid */}
            <div className="dash-stats-grid dash-stats-grid-auto">
              {cards.map((card) => (
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

            {typeof s.unmatchedRequests === 'number' && s.unmatchedRequests > 0 && (
              <div className="alert-warning flex justify-between items-center flex-wrap gap-12 mb-24">
                <div>
                  <strong>ANALYTICS GAP:</strong> {fmt(s.unmatchedRequests)} requests & {fmtTokens(s.unmatchedTokens || 0)} tokens are not linked to accounts.
                </div>
                <div className="text-10 uppercase" style={{ letterSpacing: '0.05em' }}>
                  Coverage: {coveragePct}%
                </div>
              </div>
            )}

            {/* Trends Section */}
            <div className="dash-grid-2 mb-24">
              <div className="dash-card mb-0">
                <div className="dash-card-title flex-between">
                  <span>Usage Trend (14d)</span>
                  <span className="badge badge-success">Live telemetry</span>
                </div>
                {recentTrend.length > 0 ? (
                  <div>
                    <div className="border-default p-16 bg-bg mb-16">
                      <TrendSparkline points={trendRequests} color="var(--accent)" height={120} />
                    </div>
                    <div className="dash-params-grid">
                      <div className="dash-param">
                        <div className="dash-param-label">Peak Activity</div>
                        <div className="dash-param-value">{peakTrendDay?.date || '—'}</div>
                      </div>
                      <div className="dash-param">
                        <div className="dash-param-label">14d Total Requests</div>
                        <div className="dash-param-value">{fmt(recentTrend.reduce((sum, day) => sum + day.requests, 0))}</div>
                      </div>
                      <div className="dash-param">
                        <div className="dash-param-label">14d Total Cost</div>
                        <div className="dash-param-value">{fmtUSD(Math.round(recentTrend.reduce((sum, day) => sum + day.cost, 0) * 100))}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted text-12 mono">No usage trend data is available yet.</div>
                )}
              </div>

              <div className="dash-card mb-0">
                <div className="dash-card-title flex-between">
                  <span>Cost Volatility</span>
                  <button onClick={() => handleTabChange('forecast')} className="dash-logout">Open forecast</button>
                </div>
                {recentTrend.length > 0 ? (
                  <div>
                    <div className="border-default p-16 bg-bg mb-16">
                      <TrendSparkline points={trendCost} color="#ef4444" height={120} />
                    </div>
                    <div className="flex flex-col gap-4">
                      {recentTrend.slice(-4).map((day) => (
                        <div key={day.date} className="flex flex-between px-12 py-6 bg-surface border-default text-11 mono">
                          <span className="text-muted">{day.date}</span>
                          <span className="font-600">{fmtUSD(Math.round(day.cost * 100))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-muted text-12 mono">No cost volatility data is available yet.</div>
                )}
              </div>
            </div>

            {/* Model drilldown grids */}
            <div className="dash-grid-1-1 mb-24">
              <div className="dash-card mb-0">
                <div className="dash-card-title flex-between">
                  <span>Model Economics</span>
                  <span className="badge">Cost Breakdown</span>
                </div>
                <div className="border-bright p-16 mb-16 flex flex-between items-center">
                  <div>
                    <div className="text-10 uppercase text-muted mono">Top Model Request Share</div>
                    <div className="text-20 font-700 mono text-accent">
                      {totalModelRequests > 0 ? `${Math.round((modelEconomics[0]?.share || 0) * 100)}%` : '—'}
                    </div>
                  </div>
                  <div className="text-right text-11 text-muted">
                    {modelEconomics[0]?.model || 'No data'} is leading the mix.
                  </div>
                </div>
                <div className="flex flex-col gap-6">
                  {modelEconomics.length > 0 ? modelEconomics.map((model) => (
                    <div key={model.model} className="flex flex-between px-12 py-10 border-default bg-surface text-12">
                      <div className="min-w-0">
                        <div className="font-600 mono truncate">{model.model}</div>
                        <div className="text-10 text-muted mt-2">
                          {fmt(model.requests)} requests · {Math.round(model.share * 100)}% share
                        </div>
                      </div>
                      <div className="text-right mono">
                        <div className="font-600">{fmtUSD(Math.round(model.estimatedCost))}</div>
                        <div className="text-9 text-muted">est. cost</div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-muted text-12 mono">No model statistics.</div>
                  )}
                </div>
              </div>

              <div className="dash-card mb-0">
                <div className="dash-card-title flex-between">
                  <span>Model Registry Load</span>
                  <Link href="/admin/infrastructure?tab=models" className="dash-logout no-underline">Open Registry →</Link>
                </div>
                <div className="dash-grid-3-auto-fill">
                  {modelEconomics.length > 0 ? modelEconomics.slice(0, 6).map((model, index) => (
                    <div key={model.model} className="border-default p-12 bg-surface">
                      <div className="flex flex-between items-center mb-8">
                        <span className="text-11 font-700 mono truncate" style={{ maxWidth: '80px' }}>
                          {model.model}
                        </span>
                        <span className="badge badge-accent">#{index + 1}</span>
                      </div>
                      <div className="text-11 mono">{fmt(model.requests)} reqs</div>
                      <div className="text-10 text-muted mt-4 mono">Spend: {fmtUSD(Math.round(model.estimatedCost))}</div>
                    </div>
                  )) : (
                    <div className="text-muted text-12 mono">No model data available.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Accounts & Focus List */}
            <div className="dash-grid-2">
              <div className="dash-card mb-0 overflow-x-auto">
                <div className="dash-card-title flex-between">
                  <span>Recent Customer Registrations</span>
                  <Link href="/admin/customers?tab=accounts" className="dash-logout no-underline">All Accounts →</Link>
                </div>
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Plan</th>
                      <th>Joined</th>
                      <th className="text-right">Requests</th>
                      <th className="text-right">Keys</th>
                      <th className="text-right">Paid</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUsers.map(user => (
                      <tr key={user.id}>
                        <td>
                          <div className="flex items-center gap-8">
                            <div className="dash-avatar" style={{ width: '24px', height: '24px', fontSize: '10px' }}>
                              {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-600 text-12 truncate" style={{ maxWidth: '120px' }}>{user.name || '—'}</div>
                              <div className="text-10 text-muted truncate" style={{ maxWidth: '120px' }}>{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${user.plan.id === 'free' ? 'badge-warning' : user.plan.id === 'pro' ? 'badge-accent' : 'badge-success'}`}>
                            {user.plan.name}
                          </span>
                        </td>
                        <td className="mono text-11 text-muted">
                          {timeAgo(user.createdAt)}
                        </td>
                        <td className="text-right mono">
                          {fmt(user.usage.totalRequests)}
                        </td>
                        <td className="text-right mono">
                          {user.apiKeys.length}
                        </td>
                        <td className="text-right mono" style={{ color: user.totalPaidCents > 0 ? 'var(--accent)' : 'var(--muted)' }}>
                          {user.totalPaidCents > 0 ? fmtUSD(user.totalPaidCents) : '—'}
                        </td>
                        <td className="text-center">
                          <span className={`badge ${user.emailVerified ? 'badge-success' : 'badge-warning'}`}>
                            {user.emailVerified ? 'verified' : 'pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-24">
                <div className="dash-card mb-0 flex-1">
                  <div className="dash-card-title">Focus List</div>
                  <div className="flex flex-col gap-10">
                    {focusUsers.length > 0 ? focusUsers.map(user => (
                      <div key={user.id} className="border-default p-12 bg-surface">
                        <div className="flex justify-between items-start gap-8">
                          <div className="min-w-0">
                            <div className="font-600 text-12 truncate">{user.name || user.email}</div>
                            <div className="text-10 text-muted mt-2">
                              {user.emailVerified ? 'Verified' : 'Unverified'} · {user.apiKeys.length} keys · {fmt(user.usage.totalRequests)} reqs
                            </div>
                          </div>
                          <span className="badge badge-warning" style={{ fontSize: '8px' }}>Review</span>
                        </div>
                      </div>
                    )) : (
                      <div className="text-muted text-11 mono">No accounts need attention.</div>
                    )}
                  </div>
                </div>

                <div className="dash-card mb-0">
                  <div className="dash-card-title">Top Operations Mix</div>
                  <div className="flex flex-col gap-6">
                    {topModels.length > 0 ? topModels.map((m: ModelUsage, i: number) => (
                      <div key={i} className="flex flex-between items-center px-12 py-8" style={{ background: i === 0 ? 'var(--accent-dim)' : 'var(--surface)', border: i === 0 ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                        <div className="flex items-center gap-6">
                          <span className="text-10 text-muted mono">{i + 1}.</span>
                          <span className="text-11 font-600 mono">{m.model}</span>
                        </div>
                        <span className="text-11 mono text-muted">{fmt(m.requests || 0)} reqs</span>
                      </div>
                    )) : (
                      <div className="text-muted text-11 mono">No operational usage.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )
      )}

      {activeTab === 'usage' && <UsageAdminPage />}
      {activeTab === 'forecast' && <ForecastPage />}
    </div>
  );
}

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="auth-spinner" />
      </div>
    }>
      <AdminOverviewPageContent />
    </Suspense>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface UserData {
  plan: {
    id: string;
    name: string;
    priceCents: number;
    requestsPerDay: number;
    requestsPerMinute: number;
    requestsPerMonth: number;
    allowedModels: string;
  };
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

interface AdminData {
  summary: Summary;
  users: UserData[];
  globalAnalytics: { dailyTrend: TrendPoint[]; byModel: ModelUsage[] };
  range: string;
}

const RANGE_OPTIONS = ['7d', '30d', '90d', 'all'] as const;

export default function AdminPlansPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]>('all');

  const fetchData = useCallback(async (selectedRange: (typeof RANGE_OPTIONS)[number] = range) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?range=${selectedRange}`);
      if (!res.ok) {
        setError('Failed to load plans');
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
  const fmtTokens = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;

  const plans = useMemo(() => {
    const byId = new Map<string, UserData['plan']>();
    for (const user of data?.users || []) {
      if (!byId.has(user.plan.id)) byId.set(user.plan.id, user.plan);
    }
    return (data?.summary.planBreakdown || []).map(plan => ({
      ...plan,
      meta: byId.get(plan.id),
    }));
  }, [data]);

  useEffect(() => {
    void fetchData(range);
  }, [range, fetchData]);

  if (loading || !data) {
    return (
      <div className="loading-box">
        <div className="auth-spinner" />
      </div>
    );
  }

  const s = data.summary;
  const payingAccounts = data.users.filter(u => u.plan.priceCents > 0).length;
  const activePlans = plans.length;

  return (
    <div>
      {/* Header */}
      <div className="dash-page-header flex justify-between items-end flex-wrap gap-20">
        <div>
          <h1 className="dash-page-title">Pricing & Plan Tiers</h1>
          <p className="dash-page-sub">
            Review subscription levels, active user distribution, request daily limitations, and metadata configurations.
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
              className={range === r ? 'btn-xs btn-xs-accent' : 'btn-xs'}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="error-box">
          Error: {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="dash-stats-grid dash-stats-grid-auto">
        {[
          { label: 'Active Tiers', value: fmt(activePlans), sub: 'configurations', color: 'var(--accent)' },
          { label: 'Paying Clients', value: fmt(payingAccounts), sub: 'active subscriptions', color: 'var(--text)' },
          { label: 'Total Revenue', value: fmtUSD(s.totalRevenueCents), sub: 'all active accounts', color: 'var(--accent)' },
          { label: 'Total Requests', value: fmtTokens(s.totalRequests), sub: `range: ${data.range.toUpperCase()}`, color: 'var(--muted)' },
        ].map((card, i) => (
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

      {/* Plans List Grid */}
      <div className="dash-grid-2 mb-24">
        {plans.map((plan, i) => {
          const share = s.totalUsers > 0 ? Math.round((plan.userCount / s.totalUsers) * 100) : 0;
          const meta = plan.meta;
          return (
            <div key={plan.id} className="dash-card mb-0">
              <div className="flex justify-between items-start" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
                <div>
                  <div className="badge badge-accent mb-6">{plan.id.toUpperCase()}</div>
                  <h2 className="font-700" style={{ fontSize: '18px', margin: 0 }}>{plan.name}</h2>
                  <p className="text-muted text-12" style={{ marginTop: '4px' }}>
                    Assigned to {fmt(plan.userCount)} accounts ({share}%)
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-700 mono text-bright" style={{ fontSize: '22px' }}>
                    {plan.priceCents === 0 ? '$0' : fmtUSD(plan.priceCents)}
                  </div>
                  <div className="text-9 text-muted mono">
                    {plan.priceCents === 0 ? 'free-tier' : 'per month'}
                  </div>
                </div>
              </div>

              {/* Limits Parameters Grid */}
              <div className="dash-params-grid mb-16">
                <div className="dash-param">
                  <div className="dash-param-label">Requests / Day</div>
                  <div className="dash-param-value">{meta?.requestsPerDay ? fmt(meta.requestsPerDay) : '—'}</div>
                </div>
                <div className="dash-param">
                  <div className="dash-param-label">Requests / Month</div>
                  <div className="dash-param-value">{meta?.requestsPerMonth ? fmt(meta.requestsPerMonth) : '—'}</div>
                </div>
                <div className="dash-param">
                  <div className="dash-param-label">Requests / Min</div>
                  <div className="dash-param-value">{meta?.requestsPerMinute ? fmt(meta.requestsPerMinute) : '—'}</div>
                </div>
              </div>

              <div className="mb-16">
                <div className="flex justify-between text-11" style={{ marginBottom: '4px' }}>
                  <span className="text-muted">User Volume Share</span>
                  <span className="font-600 mono">{share}%</span>
                </div>
                <div style={{ height: '4px', background: 'var(--border-bright)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--accent)', width: `${Math.max(share, 4)}%` }} />
                </div>
              </div>

              <div className="text-muted mono text-11" style={{ marginBottom: '20px' }}>
                Allowed Models:{' '}
                <span className="text-bright font-600">
                  {meta?.allowedModels === '*' ? 'All available models' : meta?.allowedModels || '—'}
                </span>
              </div>

              <div className="flex gap-8 flex-wrap">
                <button className="btn-xs btn-xs-accent">
                  Edit Tier
                </button>
                <button className="btn-xs">
                  View Accounts
                </button>
                <button className="btn-xs">
                  Clone Plan
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Plan matrix list */}
      <div className="dash-card p-0 overflow-hidden">
        <div className="dash-card-title pt-24" style={{ paddingLeft: '24px', paddingRight: '24px' }}>Plan Specification Matrix</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="dash-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: '24px' }}>Plan ID</th>
                <th>Price</th>
                <th className="text-right">Active Users</th>
                <th className="text-right">Requests / Day</th>
                <th className="text-right">Requests / Min</th>
                <th style={{ paddingRight: '24px' }}>Allowed Models</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => (
                <tr key={plan.id}>
                  <td className="font-600" style={{ paddingLeft: '24px' }}>{plan.name}</td>
                  <td className="text-muted">{plan.priceCents === 0 ? 'Free' : fmtUSD(plan.priceCents)}</td>
                  <td className="text-right mono">{fmt(plan.userCount)}</td>
                  <td className="text-right mono">{plan.meta?.requestsPerDay ? fmt(plan.meta.requestsPerDay) : '—'}</td>
                  <td className="text-right mono">{plan.meta?.requestsPerMinute ? fmt(plan.meta.requestsPerMinute) : '—'}</td>
                  <td className="text-muted truncate" style={{ paddingRight: '24px', maxWidth: '300px' }}>
                    {plan.meta?.allowedModels === '*' ? 'All models' : plan.meta?.allowedModels || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

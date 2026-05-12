'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

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

const RANGE_OPTIONS = ['7d', '30d', '90d'] as const;

export default function AdminPlansPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]>('30d');

  const fetchData = useCallback(async (adminSecret: string, selectedRange: (typeof RANGE_OPTIONS)[number] = range) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?range=${selectedRange}`, {
        headers: { Authorization: `Bearer ${adminSecret}` },
      });
      if (!res.ok) {
        setError(res.status === 403 ? 'Invalid admin secret' : 'Failed to load plans');
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

  if (!authed) {
    return (
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center px-6" style={{ background: 'var(--color-bg-primary)' }}>
        <form onSubmit={(e) => { e.preventDefault(); setAuthed(true); void fetchData(secret, range); }} className="glass-card p-8 w-full max-w-md animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f59e0b, #8b5cf6)' }}>
              <span style={{ fontSize: '1.25rem' }}>📦</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">Plan Management</h1>
              <p className="text-xs text-[var(--color-text-muted)]">Enter your admin secret to continue</p>
            </div>
          </div>
          {error && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}
          <input type="password" value={secret} onChange={e => setSecret(e.target.value)} placeholder="Admin secret" className="input-field mb-4" autoFocus />
          <button type="submit" className="btn-primary w-full">Open Plan Manager</button>
        </form>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading plan manager…</p>
        </div>
      </div>
    );
  }

  const s = data.summary;
  const payingAccounts = data.users.filter(u => u.plan.priceCents > 0).length;
  const activePlans = plans.length;

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="glass-card p-6 mb-8 border border-[rgba(245,158,11,0.18)] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at top right, rgba(245,158,11,0.18), transparent 35%)' }} />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(245,158,11,0.12)] text-[rgb(251,191,36)] text-xs font-semibold uppercase tracking-wider mb-4 border border-[rgba(245,158,11,0.2)]">
                Pricing & Plan Control
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05] mb-3">
                Keep the pricing stack aligned with the product.
              </h1>
              <p className="text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
                This page gives the owner a live view of each subscription tier, how many users are on it, and what limits are in effect.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {RANGE_OPTIONS.map(r => (
                <button
                  key={r}
                  onClick={() => {
                    setRange(r);
                    if (authed) void fetchData(secret, r);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${range === r ? 'text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}
                  style={range === r ? { background: 'linear-gradient(135deg, #f59e0b, #8b5cf6)' } : { background: 'var(--color-bg-card)' }}
                >
                  {r.toUpperCase()}
                </button>
              ))}
              <Link href="/admin/users" className="btn-secondary text-xs py-1.5 px-3">Accounts</Link>
              <Link href="/dashboard/billing" className="btn-secondary text-xs py-1.5 px-3">Portal Billing</Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Plans', value: fmt(activePlans), sub: 'active tiers', color: '#f59e0b' },
            { label: 'Paid Accounts', value: fmt(payingAccounts), sub: 'customer subscriptions', color: '#10b981' },
            { label: 'Revenue', value: fmtUSD(s.totalRevenueCents), sub: 'all plans', color: '#8b5cf6' },
            { label: 'Requests', value: fmtTokens(s.totalRequests), sub: `range ${data.range.toUpperCase()}`, color: '#ef4444' },
          ].map((card, i) => (
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

        <div className="grid xl:grid-cols-2 gap-6 mb-8">
          {plans.map((plan, i) => {
            const share = s.totalUsers > 0 ? Math.round((plan.userCount / s.totalUsers) * 100) : 0;
            const meta = plan.meta;
            return (
              <div key={plan.id} className="glass-card p-6 relative overflow-hidden" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="absolute inset-0 pointer-events-none opacity-60" style={{ background: i % 2 === 0 ? 'linear-gradient(135deg, rgba(245,158,11,0.10), transparent)' : 'linear-gradient(135deg, rgba(99,102,241,0.10), transparent)' }} />
                <div className="relative">
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-3" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--color-text-muted)' }}>
                        {plan.id}
                      </div>
                      <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
                      <p className="text-[var(--color-text-secondary)] text-sm">Used by {fmt(plan.userCount)} accounts ({share}%).</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-white">{plan.priceCents === 0 ? '$0' : fmtUSD(plan.priceCents)}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{plan.priceCents === 0 ? 'free tier' : '/ month'}</div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3 mb-5">
                    <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                      <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Requests / Day</div>
                      <div className="font-semibold">{meta?.requestsPerDay ? fmt(meta.requestsPerDay) : '—'}</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                      <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Requests / Month</div>
                      <div className="font-semibold">{meta?.requestsPerMonth ? fmt(meta.requestsPerMonth) : '—'}</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                      <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Requests / Min</div>
                      <div className="font-semibold">{meta?.requestsPerMinute ? fmt(meta.requestsPerMinute) : '—'}</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[var(--color-text-muted)]">User Share</span>
                      <span className="font-mono">{share}%</span>
                    </div>
                    <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(share, 4)}%`, background: 'linear-gradient(90deg, #f59e0b, #8b5cf6)' }} />
                    </div>
                  </div>

                  <div className="text-xs text-[var(--color-text-muted)] mb-4">
                    Allowed models: <span className="text-[var(--color-text-secondary)]">{meta?.allowedModels === '*' ? 'All' : meta?.allowedModels || 'Unknown'}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button className="btn-primary text-sm px-4 py-2">Edit Tier</button>
                    <button className="btn-secondary text-sm px-4 py-2">View Accounts</button>
                    <button className="btn-secondary text-sm px-4 py-2">Clone Plan</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="glass-card overflow-hidden">
          <div className="p-6 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold">Plan Matrix</h2>
            <p className="text-sm text-[var(--color-text-muted)]">A quick comparison of the tiers currently in use.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wider" style={{ background: 'var(--color-bg-secondary)' }}>
                  <th className="px-6 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold text-right">Users</th>
                  <th className="px-4 py-3 font-semibold text-right">Req / Day</th>
                  <th className="px-4 py-3 font-semibold text-right">Req / Min</th>
                  <th className="px-4 py-3 font-semibold">Allowed Models</th>
                </tr>
              </thead>
              <tbody>
                {plans.map(plan => (
                  <tr key={plan.id} className="border-t border-[rgba(255,255,255,0.03)] hover:bg-[var(--color-bg-card)] transition-colors">
                    <td className="px-6 py-4 font-medium">{plan.name}</td>
                    <td className="px-4 py-4 text-[var(--color-text-muted)]">{plan.priceCents === 0 ? 'Free' : fmtUSD(plan.priceCents)}</td>
                    <td className="px-4 py-4 text-right font-mono">{fmt(plan.userCount)}</td>
                    <td className="px-4 py-4 text-right font-mono">{plan.meta?.requestsPerDay ? fmt(plan.meta.requestsPerDay) : '—'}</td>
                    <td className="px-4 py-4 text-right font-mono">{plan.meta?.requestsPerMinute ? fmt(plan.meta.requestsPerMinute) : '—'}</td>
                    <td className="px-4 py-4 text-[var(--color-text-muted)] max-w-[420px] truncate">{plan.meta?.allowedModels === '*' ? 'All models' : plan.meta?.allowedModels || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

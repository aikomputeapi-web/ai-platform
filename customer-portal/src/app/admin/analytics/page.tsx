'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface UserData {
  id: string; email: string; name: string | null; emailVerified: boolean;
  plan: { id: string; name: string; priceCents: number; requestsPerDay: number };
  createdAt: string; apiKeys: any[]; payments: any[];
  usage: { totalTokens: number; totalRequests: number; totalCost: number; promptTokens: number; completionTokens: number; topModels: { model: string; requests: number }[] };
  totalPaidCents: number;
}

interface Summary {
  totalUsers: number; verifiedUsers: number; totalApiKeys: number; activeApiKeys: number;
  totalRevenueCents: number; totalRequests: number; totalTokens: number; totalCost: number;
  planBreakdown: { id: string; name: string; priceCents: number; userCount: number }[];
}

interface AnalyticsData { summary: Summary; users: UserData[]; globalAnalytics: { dailyTrend: any[]; byModel: any[] }; range: string }

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [range, setRange] = useState('30d');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'requests' | 'tokens' | 'paid' | 'date'>('date');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const fetchData = useCallback(async (adminSecret: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?range=${range}`, {
        headers: { Authorization: `Bearer ${adminSecret}` },
      });
      if (!res.ok) { setError(res.status === 403 ? 'Invalid admin secret' : 'Failed to load'); setAuthed(false); return; }
      const json = await res.json();
      setData(json);
      setError('');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { if (authed) fetchData(secret); }, [authed, range, fetchData, secret]);

  const handleLogin = (e: React.FormEvent) => { e.preventDefault(); setAuthed(true); };

  const fmt = (n: number) => n.toLocaleString();
  const fmtUSD = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const fmtTokens = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;
  const timeAgo = (d: string) => {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`;
  };

  // Filter & sort users
  const filteredUsers = data?.users
    ?.filter(u => !search || u.email.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'requests') return b.usage.totalRequests - a.usage.totalRequests;
      if (sortBy === 'tokens') return b.usage.totalTokens - a.usage.totalTokens;
      if (sortBy === 'paid') return b.totalPaidCents - a.totalPaidCents;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }) || [];

  // Auth gate
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <form onSubmit={handleLogin} className="glass-card p-8 w-full max-w-md animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <span style={{ fontSize: '1.25rem' }}>🛡️</span>
            </div>
            <div><h1 className="text-xl font-bold">Admin Analytics</h1><p className="text-xs text-[var(--color-text-muted)]">Enter your admin secret to continue</p></div>
          </div>
          {error && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}
          <input type="password" value={secret} onChange={e => setSecret(e.target.value)} placeholder="Admin secret or initial password" className="input-field mb-4" autoFocus />
          <button type="submit" className="btn-primary w-full">Access Dashboard</button>
        </form>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading analytics…</p>
        </div>
      </div>
    );
  }

  const s = data!.summary;

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
      {/* Header */}
      <header className="border-b border-[var(--color-border)] sticky top-0 z-50" style={{ background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
              </div>
              <span className="font-bold text-lg tracking-tight">Admin Analytics</span>
            </Link>
            <span className="badge-accent ml-2">ADMIN</span>
          </div>
          <div className="flex items-center gap-3">
            {['7d', '30d', '90d'].map(r => (
              <button key={r} onClick={() => setRange(r)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${range === r ? 'text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}
                style={range === r ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' } : { background: 'var(--color-bg-card)' }}>{r.toUpperCase()}</button>
            ))}
            <button onClick={() => fetchData(secret)} className="btn-secondary text-xs py-1.5 px-3">↻ Refresh</button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
          {[
            { label: 'Users', value: fmt(s.totalUsers), icon: '👥', color: '#6366f1' },
            { label: 'Verified', value: fmt(s.verifiedUsers), icon: '✓', color: '#10b981' },
            { label: 'API Keys', value: fmt(s.totalApiKeys), icon: '🔑', color: '#f59e0b' },
            { label: 'Active Keys', value: fmt(s.activeApiKeys), icon: '⚡', color: '#3b82f6' },
            { label: 'Requests', value: fmtTokens(s.totalRequests), icon: '📡', color: '#8b5cf6' },
            { label: 'Tokens', value: fmtTokens(s.totalTokens), icon: '🔢', color: '#ec4899' },
            { label: 'API Cost', value: `$${s.totalCost.toFixed(2)}`, icon: '💸', color: '#ef4444' },
            { label: 'Revenue', value: fmtUSD(s.totalRevenueCents), icon: '💰', color: '#10b981' },
          ].map((kpi, i) => (
            <div key={i} className="stat-card" style={{ animationDelay: `${i * 0.04}s` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--color-text-muted)] text-xs font-medium">{kpi.label}</span>
                <span className="text-base">{kpi.icon}</span>
              </div>
              <div className="stat-value text-xl">{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Plan Breakdown */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="glass-card p-6">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">📋 Plan Distribution</h2>
            <div className="space-y-3">
              {s.planBreakdown.map(plan => {
                const pct = s.totalUsers > 0 ? (plan.userCount / s.totalUsers) * 100 : 0;
                return (
                  <div key={plan.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{plan.name} <span className="text-[var(--color-text-muted)]">({plan.priceCents === 0 ? 'Free' : fmtUSD(plan.priceCents) + '/mo'})</span></span>
                      <span className="text-[var(--color-text-muted)]">{plan.userCount} users ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">🏆 Top Models (Platform-wide)</h2>
            <div className="space-y-2">
              {(data!.globalAnalytics.byModel || []).slice(0, 8).map((m: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: i === 0 ? 'var(--color-accent-subtle)' : 'transparent' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-muted)] w-5">{i + 1}.</span>
                    <span className="text-sm font-medium font-mono">{m.model}</span>
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">{fmt(m.requests || 0)} reqs</span>
                </div>
              ))}
              {(!data!.globalAnalytics.byModel?.length) && <p className="text-sm text-[var(--color-text-muted)] italic">No model usage data yet</p>}
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="glass-card overflow-hidden">
          {/* Table Header */}
          <div className="p-6 border-b border-[var(--color-border)]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">👥 Registered Accounts <span className="badge-accent">{filteredUsers.length}</span></h2>
              <div className="flex items-center gap-3">
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email or name…" className="input-field text-sm py-2 w-64" />
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="input-field text-sm py-2 w-40" style={{ appearance: 'auto' }}>
                  <option value="date">Newest First</option>
                  <option value="requests">Most Requests</option>
                  <option value="tokens">Most Tokens</option>
                  <option value="paid">Highest Paid</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wider" style={{ background: 'var(--color-bg-secondary)' }}>
                  <th className="px-6 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                  <th className="px-4 py-3 font-semibold text-right">Requests</th>
                  <th className="px-4 py-3 font-semibold text-right">Tokens</th>
                  <th className="px-4 py-3 font-semibold text-right">API Cost</th>
                  <th className="px-4 py-3 font-semibold text-right">Paid</th>
                  <th className="px-4 py-3 font-semibold text-center">Keys</th>
                  <th className="px-4 py-3 font-semibold text-center">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <>
                    <tr key={user.id} className="border-t border-[rgba(255,255,255,0.03)] hover:bg-[var(--color-bg-card)] transition-colors cursor-pointer" onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                            {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate max-w-[200px]">{user.name || '—'}</div>
                            <div className="text-xs text-[var(--color-text-muted)] truncate max-w-[200px]">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4"><span className={`badge-${user.plan.id === 'free' ? 'warning' : user.plan.id === 'pro' ? 'accent' : 'success'}`}>{user.plan.name}</span></td>
                      <td className="px-4 py-4 text-[var(--color-text-muted)]"><span title={new Date(user.createdAt).toLocaleString()}>{timeAgo(user.createdAt)}</span></td>
                      <td className="px-4 py-4 text-right font-mono font-medium">{fmt(user.usage.totalRequests)}</td>
                      <td className="px-4 py-4 text-right font-mono">{fmtTokens(user.usage.totalTokens)}</td>
                      <td className="px-4 py-4 text-right font-mono text-[var(--color-text-muted)]">${user.usage.totalCost.toFixed(4)}</td>
                      <td className="px-4 py-4 text-right font-mono" style={{ color: user.totalPaidCents > 0 ? '#10b981' : 'var(--color-text-muted)' }}>{user.totalPaidCents > 0 ? fmtUSD(user.totalPaidCents) : '—'}</td>
                      <td className="px-4 py-4 text-center"><span className="badge-accent">{user.apiKeys.length}</span></td>
                      <td className="px-4 py-4 text-center">{user.emailVerified ? <span className="badge-success">verified</span> : <span className="badge-warning">pending</span>}</td>
                      <td className="px-4 py-4 text-right text-[var(--color-text-muted)]"><span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: expandedUser === user.id ? 'rotate(180deg)' : 'rotate(0)' }}>▾</span></td>
                    </tr>
                    {expandedUser === user.id && (
                      <tr key={`${user.id}-detail`} className="border-t border-[rgba(255,255,255,0.03)]">
                        <td colSpan={10} className="px-6 py-6" style={{ background: 'var(--color-bg-secondary)' }}>
                          <div className="grid md:grid-cols-3 gap-6 animate-fade-in">
                            {/* Token Breakdown */}
                            <div className="glass-card p-4">
                              <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-3">Token Breakdown</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Prompt Tokens</span><span className="font-mono">{fmtTokens(user.usage.promptTokens)}</span></div>
                                <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Completion Tokens</span><span className="font-mono">{fmtTokens(user.usage.completionTokens)}</span></div>
                                <div className="flex justify-between border-t border-[var(--color-border)] pt-2 mt-2"><span className="font-medium">Total</span><span className="font-mono font-medium">{fmtTokens(user.usage.totalTokens)}</span></div>
                              </div>
                            </div>
                            {/* Top Models */}
                            <div className="glass-card p-4">
                              <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-3">Top Models Used</h4>
                              {user.usage.topModels.length > 0 ? (
                                <div className="space-y-2">
                                  {user.usage.topModels.map((m, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm">
                                      <span className="font-mono text-xs truncate max-w-[160px]">{m.model}</span>
                                      <span className="text-[var(--color-text-muted)]">{fmt(m.requests)} reqs</span>
                                    </div>
                                  ))}
                                </div>
                              ) : <p className="text-xs text-[var(--color-text-muted)] italic">No usage yet</p>}
                            </div>
                            {/* API Keys */}
                            <div className="glass-card p-4">
                              <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-3">API Keys ({user.apiKeys.length})</h4>
                              {user.apiKeys.length > 0 ? (
                                <div className="space-y-2">
                                  {user.apiKeys.map(k => (
                                    <div key={k.id} className="flex items-center justify-between text-sm p-2 rounded-lg" style={{ background: 'var(--color-bg-primary)' }}>
                                      <div><span className="font-medium">{k.name}</span><span className="text-[var(--color-text-muted)] ml-2 font-mono text-xs">****{k.lastFour}</span></div>
                                      {k.isActive ? <span className="badge-success text-[10px]">active</span> : <span className="badge-danger text-[10px]">revoked</span>}
                                    </div>
                                  ))}
                                </div>
                              ) : <p className="text-xs text-[var(--color-text-muted)] italic">No keys created</p>}
                            </div>
                          </div>
                          {/* Payments */}
                          {user.payments.length > 0 && (
                            <div className="mt-4 glass-card p-4">
                              <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-3">Payment History</h4>
                              <div className="space-y-2">
                                {user.payments.slice(0, 5).map(p => (
                                  <div key={p.id} className="flex items-center justify-between text-sm">
                                    <span className="text-[var(--color-text-muted)]">{new Date(p.createdAt).toLocaleDateString()}</span>
                                    <span className="font-mono">{fmtUSD(p.amountCents)}</span>
                                    <span className={`badge-${p.status === 'succeeded' || p.status === 'completed' ? 'success' : p.status === 'pending' ? 'warning' : 'danger'}`}>{p.status}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <div className="text-center py-16 text-[var(--color-text-muted)]"><p className="text-lg mb-2">No users found</p><p className="text-sm">Try adjusting your search query</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

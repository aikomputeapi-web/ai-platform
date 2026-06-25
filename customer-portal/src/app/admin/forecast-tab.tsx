'use client';

import { useEffect, useState, useCallback } from 'react';

interface DayData { date: string; requests: number; tokens: number; cost: number; totalUsers?: number; newUsers?: number }
interface Projections {
  next30Days: { requests: number; tokens: number; cost: number; newUsers: number; projectedTotalUsers: number };
  last30Days: { requests: number; tokens: number; cost: number; newUsers: number; totalUsers: number };
  growthRates: { requests: number; tokens: number; cost: number; users: number };
}
interface ForecastData { historical: DayData[]; forecast: DayData[]; projections: Projections }

export default function ForecastPage() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/forecast');
      if (!res.ok) { setError('Failed'); return; }
      setData(await res.json());
      setError('');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (n: number) => n.toLocaleString();
  const fmtTokens = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;

  if (loading || !data) {
    return (
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Generating forecasts…</p>
        </div>
      </div>
    );
  }

  const p = data.projections;
  const gr = p.growthRates;

  const GrowthBadge = ({ value }: { value: number }) => (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${value > 0 ? 'bg-green-500/10 text-green-400' : value < 0 ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400'}`}>
      {value > 0 ? '↑' : value < 0 ? '↓' : '→'} {Math.abs(value)}%
    </span>
  );

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8" style={{ color: 'var(--color-text-primary)' }}>
      {/* Header */}
      <div className="glass-card p-6 mb-8 border border-[var(--color-border)] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at top right, rgba(255,255,255,0.03), transparent 45%)' }} />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-accent-subtle)] text-white text-xs font-semibold uppercase tracking-wider mb-4 border border-[var(--color-border)]">
            Forecast Engine
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05] mb-3">
            Predicted usage for the next 30 days.
          </h1>
          <p className="text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
            Based on your last 30-90 days of historical data using a combination of linear regression and exponential smoothing.
          </p>
        </div>
      </div>

      {/* Projection vs Actual Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Requests', last: fmt(p.last30Days.requests), next: fmt(p.next30Days.requests), growth: gr.requests, color: '#ffffff' },
          { label: 'Tokens', last: fmtTokens(p.last30Days.tokens), next: fmtTokens(p.next30Days.tokens), growth: gr.tokens, color: '#a1a1aa' },
          { label: 'API Cost', last: `$${p.last30Days.cost.toFixed(2)}`, next: `$${p.next30Days.cost.toFixed(2)}`, growth: gr.cost, color: '#71717a' },
          { label: 'New Users', last: fmt(p.last30Days.newUsers), next: fmt(p.next30Days.newUsers), growth: gr.users, color: '#d4d4d8' },
        ].map((card, i) => (
          <div key={i} className="stat-card" style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-[var(--color-text-muted)] font-semibold uppercase">{card.label}</span>
              <GrowthBadge value={card.growth} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">Last 30d</div>
                <div className="text-lg font-bold text-[var(--color-text-secondary)]">{card.last}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold mb-0.5" style={{ color: card.color }}>Next 30d ▸</div>
                <div className="stat-value text-lg">{card.next}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Capacity Planning */}
      <div className="glass-card p-6 mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">⚙️ Capacity & Supply Planning</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-4 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
            <div className="text-xs text-[var(--color-text-muted)] mb-2 uppercase font-semibold">Projected Daily Peak</div>
            <div className="stat-value text-2xl mb-1">{fmt(Math.round(Math.max(...data.forecast.map(d => d.requests))))}</div>
            <div className="text-xs text-[var(--color-text-muted)]">requests/day (peak forecast day)</div>
            <div className="mt-3 text-xs text-[var(--color-text-secondary)]">
              Recommended headroom: <span className="font-mono text-white">{fmt(Math.round(Math.max(...data.forecast.map(d => d.requests)) * 1.5))}</span> req/day
            </div>
          </div>
          <div className="p-4 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
            <div className="text-xs text-[var(--color-text-muted)] mb-2 uppercase font-semibold">Token Budget (30d)</div>
            <div className="stat-value text-2xl mb-1">{fmtTokens(p.next30Days.tokens)}</div>
            <div className="text-xs text-[var(--color-text-muted)]">tokens projected consumption</div>
            <div className="mt-3 text-xs text-[var(--color-text-secondary)]">
              Estimated provider cost: <span className="font-mono text-white">${p.next30Days.cost.toFixed(2)}</span>
            </div>
          </div>
          <div className="p-4 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
            <div className="text-xs text-[var(--color-text-muted)] mb-2 uppercase font-semibold">User Growth</div>
            <div className="stat-value text-2xl mb-1">{fmt(p.next30Days.projectedTotalUsers)}</div>
            <div className="text-xs text-[var(--color-text-muted)]">projected total users in 30 days</div>
            <div className="mt-3 text-xs text-[var(--color-text-secondary)]">
              +{fmt(p.next30Days.newUsers)} new signups expected <GrowthBadge value={gr.users} />
            </div>
          </div>
        </div>
      </div>



      {/* Forecast Table */}
      <div className="glass-card overflow-hidden animate-fade-in" style={{ animationDelay: '0.5s' }}>
        <div className="p-6 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold">📅 Daily Forecast Breakdown (Next 30 Days)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wider" style={{ background: 'var(--color-bg-secondary)' }}>
                <th className="px-6 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold text-right">Requests</th>
                <th className="px-4 py-3 font-semibold text-right">Tokens</th>
                <th className="px-4 py-3 font-semibold text-right">Est. Cost</th>
                <th className="px-4 py-3 font-semibold text-right">New Users</th>
                <th className="px-4 py-3 font-semibold text-right">Total Users</th>
              </tr>
            </thead>
            <tbody>
              {data.forecast.map((d, i) => (
                <tr key={i} className="border-t border-[rgba(255,255,255,0.03)] hover:bg-[var(--color-bg-card)] transition-colors">
                  <td className="px-6 py-3 font-mono text-[var(--color-text-muted)]">{d.date}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(Math.round(d.requests))}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmtTokens(Math.round(d.tokens))}</td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--color-text-secondary)]">${d.cost.toFixed(4)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--color-success)]">+{d.newUsers}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(d.totalUsers || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodology Note */}
      <div className="mt-8 glass-card p-6 opacity-70 text-sm text-[var(--color-text-muted)]">
        <h3 className="font-semibold mb-2 text-[var(--color-text-secondary)]">📐 Methodology</h3>
        <p>Forecasts are generated using a combination of <strong>linear regression</strong> for trend estimation and <strong>exponential smoothing</strong> (α=0.3) for noise reduction. Projections use the most recent 30 days as baseline and extrapolate forward. Capacity recommendations include a 1.5x safety headroom. All values are estimates and should be validated against actual provider billing.</p>
      </div>
    </div>
  );
}

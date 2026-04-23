'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface DayData { date: string; requests: number; tokens: number; cost: number; totalUsers?: number; newUsers?: number }
interface Projections {
  next30Days: { requests: number; tokens: number; cost: number; newUsers: number; projectedTotalUsers: number };
  last30Days: { requests: number; tokens: number; cost: number; newUsers: number; totalUsers: number };
  growthRates: { requests: number; tokens: number; cost: number; users: number };
}
interface ForecastData { historical: DayData[]; forecast: DayData[]; projections: Projections }

// Mini SVG chart component
function SparkChart({ historical, forecast, dataKey, color, height = 120 }: { historical: DayData[]; forecast: DayData[]; dataKey: keyof DayData; color: string; height?: number }) {
  const all = [...historical.slice(-30), ...forecast];
  const values = all.map(d => (d[dataKey] as number) || 0);
  const max = Math.max(...values, 1);
  const w = 600;
  const splitIdx = Math.min(historical.length, 30);

  const toPoint = (v: number, i: number) => `${(i / (values.length - 1)) * w},${height - (v / max) * (height - 10)}`;
  const histPoints = values.slice(0, splitIdx).map((v, i) => toPoint(v, i)).join(' ');
  const forecastPoints = values.slice(splitIdx - 1).map((v, i) => toPoint(v, i + splitIdx - 1)).join(' ');

  // Area fill
  const histArea = `0,${height} ${histPoints} ${((splitIdx - 1) / (values.length - 1)) * w},${height}`;
  const forecastStart = ((splitIdx - 1) / (values.length - 1)) * w;
  const forecastArea = `${forecastStart},${height} ${forecastPoints} ${w},${height}`;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }}>
      {/* Historical area */}
      <polygon points={histArea} fill={`${color}15`} />
      <polyline points={histPoints} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Divider */}
      <line x1={forecastStart} y1="0" x2={forecastStart} y2={height} stroke="var(--color-border)" strokeWidth="1" strokeDasharray="4 4" />
      {/* Forecast area */}
      <polygon points={forecastArea} fill={`${color}08`} />
      <polyline points={forecastPoints} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 3" opacity="0.7" />
      {/* Labels */}
      <text x="4" y="12" fill="var(--color-text-muted)" fontSize="10" fontFamily="monospace">Historical</text>
      <text x={forecastStart + 4} y="12" fill={color} fontSize="10" fontFamily="monospace" opacity="0.7">Forecast →</text>
    </svg>
  );
}

export default function ForecastPage() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);

  const fetchData = useCallback(async (s: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/forecast', { headers: { Authorization: `Bearer ${s}` } });
      if (!res.ok) { setError(res.status === 403 ? 'Invalid admin secret' : 'Failed'); setAuthed(false); return; }
      setData(await res.json());
      setError('');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (authed) fetchData(secret); }, [authed, fetchData, secret]);

  const handleLogin = (e: React.FormEvent) => { e.preventDefault(); setAuthed(true); };
  const fmt = (n: number) => n.toLocaleString();
  const fmtTokens = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;

  // Auth gate (same style as analytics)
  if (!authed) {
    return (
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center">
        <form onSubmit={handleLogin} className="glass-card p-8 w-full max-w-md animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>
              <span style={{ fontSize: '1.25rem' }}>🔮</span>
            </div>
            <div><h1 className="text-xl font-bold">Forecast Engine</h1><p className="text-xs text-[var(--color-text-muted)]">Enter admin secret to access projections</p></div>
          </div>
          {error && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}
          <input type="password" value={secret} onChange={e => setSecret(e.target.value)} placeholder="Admin secret" className="input-field mb-4" autoFocus />
          <button type="submit" className="btn-primary w-full">Access Forecasts</button>
        </form>
      </div>
    );
  }

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
    <div className="max-w-[1400px] mx-auto px-6 py-8" style={{ color: 'var(--color-text-primary)' }}>
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          🔮 Forecast Engine
          <span className="badge-accent text-[10px]">LINEAR REGRESSION + EXP SMOOTHING</span>
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Predicted usage for the next 30 days based on your last 30-90 days of historical data
        </p>
      </div>

      {/* Projection vs Actual Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Requests', last: fmt(p.last30Days.requests), next: fmt(p.next30Days.requests), growth: gr.requests, color: '#6366f1' },
          { label: 'Tokens', last: fmtTokens(p.last30Days.tokens), next: fmtTokens(p.next30Days.tokens), growth: gr.tokens, color: '#8b5cf6' },
          { label: 'API Cost', last: `$${p.last30Days.cost.toFixed(2)}`, next: `$${p.next30Days.cost.toFixed(2)}`, growth: gr.cost, color: '#ef4444' },
          { label: 'New Users', last: fmt(p.last30Days.newUsers), next: fmt(p.next30Days.newUsers), growth: gr.users, color: '#10b981' },
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
              Recommended rate limit headroom: <span className="font-mono text-[var(--color-accent)]">{fmt(Math.round(Math.max(...data.forecast.map(d => d.requests)) * 1.5))}</span> req/day
            </div>
          </div>
          <div className="p-4 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
            <div className="text-xs text-[var(--color-text-muted)] mb-2 uppercase font-semibold">Token Budget (30d)</div>
            <div className="stat-value text-2xl mb-1">{fmtTokens(p.next30Days.tokens)}</div>
            <div className="text-xs text-[var(--color-text-muted)]">tokens projected consumption</div>
            <div className="mt-3 text-xs text-[var(--color-text-secondary)]">
              Estimated provider cost: <span className="font-mono" style={{ color: '#ef4444' }}>${p.next30Days.cost.toFixed(2)}</span>
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

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {[
          { title: '📡 Requests Trend & Forecast', key: 'requests' as keyof DayData, color: '#6366f1' },
          { title: '🔢 Token Usage Trend & Forecast', key: 'tokens' as keyof DayData, color: '#8b5cf6' },
          { title: '💸 Cost Trend & Forecast', key: 'cost' as keyof DayData, color: '#ef4444' },
          { title: '👥 Total Users Trend & Forecast', key: 'totalUsers' as keyof DayData, color: '#10b981' },
        ].map((chart, i) => (
          <div key={i} className="glass-card p-6 animate-fade-in" style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
            <h3 className="text-sm font-semibold mb-4">{chart.title}</h3>
            <SparkChart historical={data.historical} forecast={data.forecast} dataKey={chart.key} color={chart.color} height={140} />
            <div className="flex items-center gap-4 mt-3 text-[10px] text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 rounded" style={{ background: chart.color }}></span> Historical</span>
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 rounded" style={{ background: chart.color, opacity: 0.5, borderBottom: `1px dashed ${chart.color}` }}></span> Projected</span>
            </div>
          </div>
        ))}
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
                  <td className="px-4 py-3 text-right font-mono" style={{ color: '#ef4444' }}>${d.cost.toFixed(4)}</td>
                  <td className="px-4 py-3 text-right font-mono" style={{ color: '#10b981' }}>+{d.newUsers}</td>
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

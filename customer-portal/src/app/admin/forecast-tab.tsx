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
      if (!res.ok) { setError('Failed to load forecast'); return; }
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
      <div className="loading-box">
        <div className="auth-spinner" />
      </div>
    );
  }

  const p = data.projections;
  const gr = p.growthRates;

  const GrowthBadge = ({ value }: { value: number }) => {
    const badgeClass = value > 0 ? 'badge-success' : value < 0 ? 'badge-danger' : '';
    return (
      <span className={`badge ${badgeClass}`} style={{ fontSize: '9px' }}>
        {value > 0 ? '↑' : value < 0 ? '↓' : '→'} {Math.abs(value)}%
      </span>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="dash-page-header">
        <h1 className="dash-page-title">Growth & Demand Forecast</h1>
        <p className="dash-page-sub">
          Predictive platform volume for the next 30 days based on linear regression and exponential smoothing.
        </p>
      </div>

      {error && (
        <div className="error-box">
          Error: {error}
        </div>
      )}

      {/* Projection vs Actual Cards Grid */}
      <div className="dash-stats-grid mb-24" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {[
          { label: 'Requests', last: fmt(p.last30Days.requests), next: fmt(p.next30Days.requests), growth: gr.requests, color: 'var(--accent)' },
          { label: 'Tokens', last: fmtTokens(p.last30Days.tokens), next: fmtTokens(p.next30Days.tokens), growth: gr.tokens, color: 'var(--muted)' },
          { label: 'API Cost', last: `$${p.last30Days.cost.toFixed(2)}`, next: `$${p.next30Days.cost.toFixed(2)}`, growth: gr.cost, color: 'var(--accent)' },
          { label: 'New Users', last: fmt(p.last30Days.newUsers), next: fmt(p.next30Days.newUsers), growth: gr.users, color: 'var(--muted)' },
        ].map((card, i) => (
          <div key={i} className="dash-stat" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div className="dash-stat-label mb-12">
              <span>{card.label}</span>
              <GrowthBadge value={card.growth} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <div className="mono text-muted" style={{ fontSize: '9px' }}>Last 30d</div>
                <div className="font-600 text-14 text-bright" style={{ marginTop: '2px' }}>{card.last}</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '12px' }}>
                <div className="mono font-600" style={{ fontSize: '9px', color: card.color }}>Next 30d ▸</div>
                <div className="font-700 text-accent text-14" style={{ marginTop: '2px' }}>{card.next}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Capacity Planning */}
      <div className="dash-card mb-24">
        <div className="dash-card-title">Capacity & Supply Planning</div>
        <div className="dash-grid-3">
          <div className="card" style={{ padding: '16px' }}>
            <div className="mono text-muted uppercase mb-8" style={{ fontSize: '10px', letterSpacing: '0.04em' }}>
              Projected Daily Peak
            </div>
            <div className="font-700 mono text-accent" style={{ fontSize: '22px', marginBottom: '4px' }}>
              {fmt(Math.round(Math.max(...data.forecast.map(d => d.requests))))}
            </div>
            <div className="text-11 text-muted">requests / day peak forecast</div>
            <div className="mt-12 text-11 text-bright" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              Headroom recommendation: <strong className="text-accent mono">{fmt(Math.round(Math.max(...data.forecast.map(d => d.requests)) * 1.5))}</strong> / day
            </div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <div className="mono text-muted uppercase mb-8" style={{ fontSize: '10px', letterSpacing: '0.04em' }}>
              Token Budget (30d)
            </div>
            <div className="font-700 mono text-bright" style={{ fontSize: '22px', marginBottom: '4px' }}>
              {fmtTokens(p.next30Days.tokens)}
            </div>
            <div className="text-11 text-muted">tokens projected volume</div>
            <div className="mt-12 text-11 text-bright" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              Estimated provider cost: <strong className="mono">${p.next30Days.cost.toFixed(2)}</strong>
            </div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <div className="mono text-muted uppercase mb-8" style={{ fontSize: '10px', letterSpacing: '0.04em' }}>
              User Growth
            </div>
            <div className="font-700 mono text-bright" style={{ fontSize: '22px', marginBottom: '4px' }}>
              {fmt(p.next30Days.projectedTotalUsers)}
            </div>
            <div className="text-11 text-muted">projected user count in 30 days</div>
            <div className="mt-12 text-11 text-bright flex-between" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <span>+{fmt(p.next30Days.newUsers)} expected signups</span>
              <GrowthBadge value={gr.users} />
            </div>
          </div>
        </div>
      </div>

      {/* Forecast Table */}
      <div className="dash-card p-0 overflow-hidden">
        <div className="dash-card-title" style={{ padding: '24px 24px 0 24px' }}>Daily Forecast Breakdown (Next 30 Days)</div>
        <div className="overflow-hidden" style={{ overflowX: 'auto' }}>
          <table className="dash-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: '24px' }}>Date</th>
                <th className="text-right">Requests</th>
                <th className="text-right">Tokens</th>
                <th className="text-right">Est. Cost</th>
                <th className="text-right">New Users</th>
                <th className="text-right" style={{ paddingRight: '24px' }}>Total Users</th>
              </tr>
            </thead>
            <tbody>
              {data.forecast.map((d, i) => (
                <tr key={i}>
                  <td className="mono text-muted" style={{ paddingLeft: '24px' }}>{d.date}</td>
                  <td className="text-right mono">{fmt(Math.round(d.requests))}</td>
                  <td className="text-right mono">{fmtTokens(Math.round(d.tokens))}</td>
                  <td className="text-right mono">${d.cost.toFixed(4)}</td>
                  <td className="text-right mono text-accent">+{d.newUsers}</td>
                  <td className="text-right mono" style={{ paddingRight: '24px' }}>{fmt(d.totalUsers || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodology Note */}
      <div className="card mt-24 text-12" style={{ padding: '20px', lineHeight: 1.6 }}>
        <strong className="block mono text-muted uppercase mb-8" style={{ fontSize: '10px' }}>
          Methodology & Telemetry Source
        </strong>
        <p className="text-muted">
          Forecasts are generated using a combination of <strong>linear regression</strong> for trend estimation and <strong>exponential smoothing</strong> (α=0.3) for noise reduction. Projections use the most recent 30 days as a baseline and extrapolate forward. Capacity recommendations include a 1.5x safety headroom. All values are estimates and should be validated against actual provider billing.
        </p>
      </div>
    </div>
  );
}

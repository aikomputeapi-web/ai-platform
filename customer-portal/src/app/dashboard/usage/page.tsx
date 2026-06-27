'use client';
import { useEffect, useState } from 'react';

export default function UsagePage() {
  const [usage, setUsage] = useState<any>(null);
  const [range, setRange] = useState('30d');
  useEffect(() => { fetch(`/api/usage?range=${range}`).then(r => r.json()).then(setUsage); }, [range]);
  const ranges = ['1d','7d','30d','90d'];

  const stats = [
    { l: 'Requests', v: usage?.summary?.totalRequests || 0 },
    { l: 'Prompt Tokens', v: usage?.summary?.promptTokens ? `${(usage.summary.promptTokens / 1000).toFixed(1)}K` : '0' },
    { l: 'Completion Tokens', v: usage?.summary?.completionTokens ? `${(usage.summary.completionTokens / 1000).toFixed(1)}K` : '0' },
    { l: 'Est. Cost', v: `$${usage?.summary?.totalCost?.toFixed(4) || '0.00'}` },
  ];

  return (
    <div>
      <div className="dash-page-header flex-between">
        <div>
          <h1 className="dash-page-title">Usage</h1>
          <p className="dash-page-sub">Track your API consumption</p>
        </div>
        <div className="dash-tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
          {ranges.map(r => (
            <button key={r} onClick={() => setRange(r)} className={`dash-tab ${range === r ? 'active' : ''}`} style={{ padding: '8px 16px' }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="dash-stats-grid">
        {stats.map((s, i) => (
          <div key={i} className="dash-stat">
            <div className="dash-stat-label">{s.l}</div>
            <div className="dash-stat-value">{s.v}</div>
          </div>
        ))}
      </div>

      {usage?.byModel?.length > 0 && (
        <div className="dash-card">
          <div className="dash-card-title">Models Used</div>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Model</th>
                <th className="text-right">Requests</th>
                <th className="text-right">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {usage.byModel.slice(0, 10).map((m: any, i: number) => (
                <tr key={i}>
                  <td className="font-600">{m.model}</td>
                  <td className="text-right mono text-12">{m.requests}</td>
                  <td className="text-right mono text-12 text-muted">{(m.totalTokens / 1000).toFixed(1)}K</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(!usage?.summary?.totalRequests) && (
        <div className="dash-card text-center" style={{ padding: '48px' }}>
          <div className="text-40 mb-16">📈</div>
          <div className="font-700 mb-8 text-15">No usage data yet</div>
          <p className="text-13 text-muted">Start making API requests to see analytics.</p>
        </div>
      )}
    </div>
  );
}

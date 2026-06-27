'use client';

import { useEffect, useState } from 'react';

export default function DashboardOverview() {
  const [user, setUser] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [keys, setKeys] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d.user));
    fetch('/api/usage?range=30d').then(r => r.json()).then(d => setUsage(d));
    fetch('/api/keys').then(r => r.json()).then(d => setKeys(d.keys || []));
  }, []);

  const stats = [
    {
      label: 'Total Requests',
      value: usage?.summary?.totalRequests?.toLocaleString() || '0',
      sub: 'Last 30 days',
      icon: '⚡',
    },
    {
      label: 'Tokens Used',
      value: usage?.summary?.totalTokens ? `${(usage.summary.totalTokens / 1000).toFixed(1)}K` : '0',
      sub: 'Last 30 days',
      icon: '🔢',
    },
    {
      label: 'API Keys',
      value: keys.length.toString(),
      sub: `of ${user?.plan?.id === 'free' ? '2' : user?.plan?.id === 'pro' ? '5' : user?.plan?.id === 'max-5x' ? '10' : '20'} max`,
      icon: '🔑',
    },
    {
      label: 'Plan',
      value: user?.plan?.name || 'Free',
      sub: user?.plan?.priceCents === 0 
        ? 'Sandbox' 
        : `Active ($${(user?.plan?.priceCents / 100).toFixed(0)}/mo)`,
      icon: '📋',
    },
  ];

  return (
    <div>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Dashboard</h1>
        <p className="dash-page-sub">
          Welcome back{user?.name ? `, ${user.name}` : ''}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="dash-stats-grid">
        {stats.map((stat, i) => (
          <div key={i} className="dash-stat">
            <div className="dash-stat-label">
              <span>{stat.label}</span>
              <span className="dash-sidebar-nav-icon">{stat.icon}</span>
            </div>
            <div className="dash-stat-value">{stat.value}</div>
            <div className="dash-stat-sub">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Quick Start */}
      <div className="dash-card">
        <div className="dash-card-title">Quick Start</div>
        <div className="dash-stack">
          <div>
            <div className="auth-label">Base URL for all API calls:</div>
            <div className="dash-code">
              {typeof window !== 'undefined' ? window.location.origin.replace(/:\d+$/, '') : 'https://yourdomain.com'}/v1
            </div>
          </div>
          <div>
            <div className="auth-label">Example request:</div>
            <pre className="dash-code dash-code-wrap">
{`curl -X POST /v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}
            </pre>
          </div>
        </div>
      </div>

      {/* Service Status */}
      <div className="dash-card">
        <div className="dash-card-title">Service Parameters</div>
        <div className="dash-params-grid">
          <div className="dash-param">
            <div className="dash-param-label">Quota Status</div>
            <div className="dash-param-value">[OK] Within Tier limits</div>
          </div>
          <div className="dash-param">
            <div className="dash-param-label">Concurrency</div>
            <div className="dash-param-value">Tier Adaptive</div>
          </div>
          <div className="dash-param">
            <div className="dash-param-label">Model Access</div>
            <div className="dash-param-value">{user?.plan?.allowedModels === '*' ? 'Full Portfolio' : 'Standard'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

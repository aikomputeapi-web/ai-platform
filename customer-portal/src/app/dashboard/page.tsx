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

  const isMonthlyPlan = !!user?.plan?.requestsPerMonth && user.plan.requestsPerMonth > 0;
  const requestLimitLabel = isMonthlyPlan ? 'req/month' : 'req/day';
  const requestLimitValue = isMonthlyPlan ? user?.plan?.requestsPerMonth : user?.plan?.requestsPerDay;

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
      sub: `of ${user?.plan?.name === 'free' ? '2' : user?.plan?.name === 'basic' ? '5' : '20'} max`,
      icon: '🔑',
    },
    {
      label: 'Plan',
      value: user?.plan?.name || 'Free',
      sub: `${requestLimitValue || (isMonthlyPlan ? 50 : 100)} ${requestLimitLabel}`,
      icon: '📋',
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">
          Welcome back{user?.name ? `, ${user.name}` : ''}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[var(--color-text-secondary)] text-sm font-medium">{stat.label}</span>
              <span className="text-lg">{stat.icon}</span>
            </div>
            <div className="stat-value">{stat.value}</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Quick Start */}
      <div className="glass-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">🚀 Quick Start</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">Base URL for all API calls:</p>
            <code className="block bg-[var(--color-bg-primary)] rounded-lg px-4 py-3 text-sm font-mono text-[var(--color-accent)]">
              {typeof window !== 'undefined' ? window.location.origin.replace(/:\d+$/, '') : 'https://yourdomain.com'}/v1
            </code>
          </div>
          <div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">Example request:</p>
            <pre className="bg-[var(--color-bg-primary)] rounded-lg px-4 py-3 text-sm font-mono text-[var(--color-text-primary)] overflow-x-auto">
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

      {/* Rate Limits */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4">📊 Your Limits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[var(--color-bg-primary)] rounded-lg p-4">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">
              {isMonthlyPlan ? 'Requests / Month' : 'Requests / Day'}
            </div>
            <div className="text-xl font-bold">
              {usage?.summary?.totalRequests || 0}{' '}
              <span className="text-sm font-normal text-[var(--color-text-muted)]">
                / {requestLimitValue || (isMonthlyPlan ? 50 : 100)}
              </span>
            </div>
            <div className="mt-2 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    ((usage?.summary?.totalRequests || 0) /
                      (requestLimitValue || (isMonthlyPlan ? 50 : 100))) *
                      100
                  )}%`,
                  background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                }}
              />
            </div>
          </div>
          <div className="bg-[var(--color-bg-primary)] rounded-lg p-4">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">Requests / Minute</div>
            <div className="text-xl font-bold">{user?.plan?.requestsPerMinute || 5} <span className="text-sm font-normal text-[var(--color-text-muted)]">rpm</span></div>
          </div>
          <div className="bg-[var(--color-bg-primary)] rounded-lg p-4">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">Models</div>
            <div className="text-xl font-bold">{user?.plan?.allowedModels === '*' ? 'All' : 'Limited'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

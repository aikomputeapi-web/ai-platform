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
    <div className="font-mono">
      <div className="mb-8">
        <h1 className="text-2xl font-bold uppercase tracking-tight">[Dashboard]</h1>
        <p className="text-[var(--color-text-secondary)] text-xs mt-1 font-medium">
          Welcome back{user?.name ? `, ${user.name}` : ''}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="flex items-center justify-between mb-3 text-[10px]">
              <span className="text-[var(--color-text-secondary)] uppercase tracking-wider font-bold">{stat.label}</span>
              <span className="text-sm">{stat.icon}</span>
            </div>
            <div className="stat-value">{stat.value}</div>
            <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Quick Start */}
      <div className="glass-card p-6 mb-6 rounded-[2px] border-[var(--color-border)]">
        <h2 className="text-sm font-bold uppercase tracking-tight text-white mb-4">[Quick Start]</h2>
        <div className="space-y-4">
          <div>
            <p className="text-[10px] text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider font-bold">Base URL for all API calls:</p>
            <code className="block bg-black border border-[var(--color-border)] rounded-[2px] px-4 py-3 text-xs font-mono text-white">
              {typeof window !== 'undefined' ? window.location.origin.replace(/:\d+$/, '') : 'https://yourdomain.com'}/v1
            </code>
          </div>
          <div>
            <p className="text-[10px] text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider font-bold">Example request:</p>
            <pre className="bg-black border border-[var(--color-border)] rounded-[2px] px-4 py-3 text-xs font-mono text-white/80 overflow-x-auto leading-relaxed">
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
      <div className="glass-card p-6 rounded-[2px] border-[var(--color-border)]">
        <h2 className="text-sm font-bold uppercase tracking-tight text-white mb-4">[Service Parameters]</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
          <div className="bg-black border border-[var(--color-border)] rounded-[2px] p-4">
            <div className="text-[9px] text-[var(--color-text-muted)] mb-1 uppercase tracking-wider font-bold">Quota Status</div>
            <div className="text-xs font-bold text-white">[OK] Within Tier limits</div>
          </div>
          <div className="bg-black border border-[var(--color-border)] rounded-[2px] p-4">
            <div className="text-[9px] text-[var(--color-text-muted)] mb-1 uppercase tracking-wider font-bold">Concurrency</div>
            <div className="text-xs font-bold text-white">Tier Adaptive</div>
          </div>
          <div className="bg-black border border-[var(--color-border)] rounded-[2px] p-4">
            <div className="text-[9px] text-[var(--color-text-muted)] mb-1 uppercase tracking-wider font-bold">Model Access</div>
            <div className="text-xs font-bold text-white">{user?.plan?.allowedModels === '*' ? 'Full Portfolio' : 'Standard'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const plans = [
  { id: 'free', name: 'Free', price: '$0', period: 'forever', requests: '50/month', rpm: '5 rpm', models: 'Free-tier models', features: ['2 API keys', 'Basic analytics', 'Community support'] },
  { id: 'basic', name: 'Basic', price: '$19', period: '/month', requests: '1,000/day', rpm: '20 rpm', models: 'All free models', features: ['5 API keys', 'Full analytics', 'Email support'], featured: true },
  { id: 'pro', name: 'Pro', price: '$49', period: '/month', requests: '10,000/day', rpm: '60 rpm', models: 'All models', features: ['20 API keys', 'Full analytics', 'Priority support', 'Webhooks'] },
];

export default function BillingPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState('');

  useEffect(() => { fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d.user)); }, []);

  async function handleUpgrade(planId: string) {
    setLoading(planId);
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || 'Stripe not configured yet. Set STRIPE_SECRET_KEY to enable payments.');
    } catch { alert('Payment error'); }
    setLoading('');
  }

  async function handleManage() {
    const res = await fetch('/api/billing/checkout');
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Billing & Plans</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">
          Current plan: <span className="badge-accent">{user?.plan?.name || 'Free'}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {plans.map(plan => (
          <div key={plan.id} className={`glass-card p-6 relative ${plan.featured ? 'ring-2 ring-[var(--color-accent)]' : ''}`}>
            {plan.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 badge-accent px-3 py-1">Popular</div>}
            <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold">{plan.price}</span>
              <span className="text-sm text-[var(--color-text-muted)]">{plan.period}</span>
            </div>
            <div className="space-y-2 mb-6 text-sm">
              <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Requests</span><span className="font-medium">{plan.requests}</span></div>
              <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Rate limit</span><span className="font-medium">{plan.rpm}</span></div>
              <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Models</span><span className="font-medium">{plan.models}</span></div>
            </div>
            <ul className="space-y-2 mb-6">
              {plan.features.map((f, i) => (<li key={i} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]"><span className="text-[var(--color-success)]">✓</span>{f}</li>))}
            </ul>
            {user?.plan?.id === plan.id ? (
              <button className="btn-secondary w-full" disabled>Current Plan</button>
            ) : plan.id === 'free' ? (
              <button className="btn-secondary w-full" disabled>Default</button>
            ) : (
              <button onClick={() => handleUpgrade(plan.id)} className="btn-primary w-full" disabled={loading === plan.id}>
                {loading === plan.id ? 'Loading...' : 'Upgrade'}
              </button>
            )}
          </div>
        ))}
      </div>

      {user?.stripeCustomerId && (
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-2">Manage Subscription</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">Update payment method, view invoices, or cancel your subscription.</p>
          <button onClick={handleManage} className="btn-secondary">Open Billing Portal</button>
        </div>
      )}
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    requests: '20/day',
    rpm: '5 rpm',
    models: 'Free-tier models',
    features: ['2 API keys', 'Basic analytics', 'Community support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$5',
    period: '/month',
    requests: '300/day',
    rpm: '30 rpm',
    models: 'Claude 4.7 Opus, Claude 4.6 Sonnet, GPT-5.5',
    features: ['5 API keys', 'Priority routing', 'Anthropic + OpenAI models', 'Webhooks'],
    featured: true,
  },
  {
    id: 'max-5x',
    name: 'Max 5x',
    price: '$20',
    period: '/month',
    requests: '600/day',
    rpm: '30 rpm',
    models: 'Claude 4.7 Opus, Claude 4.6 Sonnet, GPT-5.5',
    features: ['10 API keys', 'Higher priority routing', 'Anthropic + OpenAI models', 'Webhooks'],
  },
  {
    id: 'max-20x',
    name: 'Max 20x',
    price: '$40',
    period: '/month',
    requests: '1,200/day',
    rpm: '30 rpm',
    models: 'Claude 4.7 Opus, Claude 4.6 Sonnet, GPT-5.5',
    features: ['20 API keys', 'Highest priority routing', 'Anthropic + OpenAI models', 'Webhooks'],
  },
  {
    id: 'pay-as-you-go',
    name: 'Pay As You Go',
    price: 'Metered',
    period: 'per token',
    requests: '1,200/day limit',
    rpm: '30 rpm',
    models: 'Claude 4.7 Opus, Claude 4.6 Sonnet, GPT-5.5',
    features: [
      '10 API keys',
      'Pay only for what you use',
      'Metered usage per token',
      'Claude 3.5 Sonnet base rate ($3/$15 per M)',
      'Scale to other models via multipliers',
      'Webhooks',
    ],
  },
];

export default function BillingPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState('');
  const [canceling, setCanceling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function handleUpgrade(planId: string) {
    setLoading(planId);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || 'Stripe not configured yet. Set STRIPE_SECRET_KEY to enable payments.');
    } catch {
      alert('Payment error');
    }
    setLoading('');
  }

  async function handleManage() {
    const res = await fetch('/api/billing/checkout');
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  async function handleCancelSubscription() {
    setCanceling(true);
    try {
      const res = await fetch('/api/billing/subscription', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        alert('Subscription canceled successfully. You have been downgraded to the Free plan.');
        window.location.reload();
      } else {
        alert(data.error || 'Failed to cancel subscription');
      }
    } catch {
      alert('Failed to cancel subscription');
    }
    setCanceling(false);
    setShowCancelConfirm(false);
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Billing & Plans</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">
          Current plan: <span className="badge-accent">{user?.plan?.name || 'Free'}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
        {plans.map((plan) => (
          <div key={plan.id} className={`glass-card p-6 relative ${plan.featured ? 'ring-2 ring-[var(--color-accent)]' : ''}`}>
            {plan.featured && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 badge-accent px-3 py-1">Popular</div>
            )}
            <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold">{plan.price}</span>
              <span className="text-sm text-[var(--color-text-muted)]">{plan.period}</span>
            </div>
            <div className="space-y-2 mb-6 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Requests</span>
                <span className="font-medium">{plan.requests}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Rate limit</span>
                <span className="font-medium">{plan.rpm}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Models</span>
                <span className="font-medium">{plan.models}</span>
              </div>
            </div>
            <ul className="space-y-2 mb-6">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <span className="text-[var(--color-success)]">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            {user?.plan?.id === plan.id ? (
              <button className="btn-secondary w-full" disabled>
                Current Plan
              </button>
            ) : plan.id === 'free' ? (
              <button className="btn-secondary w-full" disabled>
                Default
              </button>
            ) : (
              <button
                onClick={() => handleUpgrade(plan.id)}
                className="btn-primary w-full"
                disabled={loading === plan.id}
              >
                {loading === plan.id ? 'Loading...' : 'Upgrade'}
              </button>
            )}
          </div>
        ))}
      </div>

      {user?.stripeCustomerId && (
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-2">Manage Subscription</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Update payment method, view invoices, or cancel your subscription.
          </p>
          <div className="flex gap-3 flex-wrap">
            <button onClick={handleManage} className="btn-secondary">
              Open Billing Portal
            </button>
            {user?.stripeSubscriptionId && user?.plan?.id !== 'free' && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="btn-danger"
                disabled={canceling}
              >
                {canceling ? 'Canceling...' : 'Cancel Subscription'}
              </button>
            )}
          </div>
        </div>
      )}

      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-card p-6 max-w-md mx-4">
            <h3 className="font-semibold text-lg mb-2">Cancel Subscription?</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Are you sure you want to cancel your subscription? You will be downgraded to the Free plan and may lose access to premium features.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="btn-secondary"
                disabled={canceling}
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                className="btn-danger"
                disabled={canceling}
              >
                {canceling ? 'Canceling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 text-sm text-[var(--color-text-muted)]">
        <Link href="/" className="underline underline-offset-4 hover:text-[var(--color-text-secondary)]">
          Back to home
        </Link>
      </div>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const plans = [
  {
    id: 'free', name: 'Free', price: '$0', period: 'forever',
    capacity: 'Evaluation', priority: 'Standard routing', models: 'Free-tier models',
    features: ['2 API keys', 'Basic analytics', 'Community support'],
  },
  {
    id: 'pro', name: 'Pro', price: '$20', period: '/month',
    capacity: 'High capacity', priority: 'Standard priority',
    models: 'Claude 4.7 Opus, Claude 4.6 Sonnet, GPT-5.5',
    features: ['5 API keys', 'Priority routing', 'Anthropic + OpenAI models', 'Webhooks'],
    featured: true,
  },
  {
    id: 'max-5x', name: 'Max 5x', price: '$100', period: '/month',
    capacity: '5x Pro capacity', priority: 'Elevated priority',
    models: 'Claude 4.7 Opus, Claude 4.6 Sonnet, GPT-5.5',
    features: ['10 API keys', 'Higher priority routing', 'Anthropic + OpenAI models', 'Webhooks'],
  },
  {
    id: 'max-20x', name: 'Max 20x', price: '$200', period: '/month',
    capacity: '20x Pro capacity', priority: 'Highest priority',
    models: 'Claude 4.7 Opus, Claude 4.6 Sonnet, GPT-5.5',
    features: ['20 API keys', 'Highest priority routing', 'Anthropic + OpenAI models', 'Webhooks'],
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
      const res = await fetch('/api/billing/subscription', { method: 'DELETE' });
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
    <div>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Billing &amp; Plans</h1>
        <p className="dash-page-sub">
          Current plan: <span className="dash-plan-badge">{user?.plan?.name || 'Free'}</span>
        </p>
      </div>

      <div className="billing-grid">
        {plans.map((plan) => (
          <div key={plan.id} className="billing-plan-card">
            {plan.featured && (
              <div className="billing-plan-badge">Popular</div>
            )}
            <div className="billing-plan-name">{plan.name}</div>
            <div className="billing-plan-price">
              <span className="billing-plan-amount">{plan.price}</span>
              <span className="billing-plan-period">{plan.period}</span>
            </div>

            <div className="billing-plan-details">
              {[
                ['Capacity', plan.capacity],
                ['Priority', plan.priority],
              ].map(([label, val]) => (
                <div key={label} className="billing-plan-detail-row">
                  <span>{label}</span>
                  <span className="billing-plan-detail-val">{val}</span>
                </div>
              ))}
            </div>

            <div className="billing-plan-features">
              {plan.features.map((f, i) => (
                <div key={i} className="billing-plan-feature">
                  <span className="billing-plan-feature-dot">●</span>{f}
                </div>
              ))}
            </div>

            {user?.plan?.id === plan.id ? (
              <button className="btn-border billing-plan-btn" disabled>Current Plan</button>
            ) : plan.id === 'free' ? (
              <button className="btn-border billing-plan-btn" disabled>Default</button>
            ) : (
              <button onClick={() => handleUpgrade(plan.id)} className="btn-accent billing-plan-btn" disabled={loading === plan.id}>
                {loading === plan.id ? 'Loading...' : 'Upgrade'}
              </button>
            )}
          </div>
        ))}
      </div>

      {user?.stripeCustomerId && (
        <div className="dash-card">
          <div className="dash-card-title">Manage Subscription</div>
          <p className="text-13 text-muted mb-16">
            Update payment method, view invoices, or cancel your subscription.
          </p>
          <div className="flex gap-12" style={{ flexWrap: 'wrap' }}>
            <button onClick={handleManage} className="btn-border lh-1">Open Billing Portal</button>
            {user?.stripeSubscriptionId && user?.plan?.id !== 'free' && (
              <button onClick={() => setShowCancelConfirm(true)} disabled={canceling} className="btn-danger">
                {canceling ? 'Canceling...' : 'Cancel Subscription'}
              </button>
            )}
          </div>
        </div>
      )}

      {showCancelConfirm && (
        <div className="modal-overlay">
          <div className="auth-card">
            <h2>Cancel Subscription?</h2>
            <p>Are you sure you want to cancel your subscription? You will be downgraded to the Free plan and may lose access to premium features.</p>
            <div className="flex gap-12" style={{ justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCancelConfirm(false)} className="btn-border" disabled={canceling}>
                Keep Subscription
              </button>
              <button onClick={handleCancelSubscription} disabled={canceling} className="btn-danger">
                {canceling ? 'Canceling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-24 text-13 text-muted">
        <Link href="/" className="text-muted" style={{ textDecoration: 'underline' }}>Back to home</Link>
      </div>
    </div>
  );
}

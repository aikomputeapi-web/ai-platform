'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const plans = [
  {
    id: 'free', name: 'Free', price: '$0', period: 'forever',
    capacity: 'Evaluation', priority: 'Standard routing', models: 'Free-tier models',
    features: ['2 API keys', 'Basic analytics', 'Community support'],
  },
  {
    id: 'pro', name: 'Pro', price: '$5', period: '/month',
    capacity: "Anthropic Pro capacity", priority: 'Standard priority',
    models: 'Claude 4.7 Opus, Claude 4.6 Sonnet, GPT-5.5',
    features: ['5 API keys', 'Priority routing', 'Anthropic + OpenAI models', 'Webhooks'],
    featured: true,
  },
  {
    id: 'max-5x', name: 'Max 5x', price: '$20', period: '/month',
    capacity: "5x Anthropic Pro capacity", priority: 'Elevated priority',
    models: 'Claude 4.7 Opus, Claude 4.6 Sonnet, GPT-5.5',
    features: ['10 API keys', 'Higher priority routing', 'Anthropic + OpenAI models', 'Webhooks'],
  },
  {
    id: 'max-20x', name: 'Max 20x', price: '$40', period: '/month',
    capacity: "20x Anthropic Pro capacity", priority: 'Highest priority',
    models: 'Claude 4.7 Opus, Claude 4.6 Sonnet, GPT-5.5',
    features: ['20 API keys', 'Highest priority routing', 'Anthropic + OpenAI models', 'Webhooks'],
  },
];

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState('');
  const [canceling, setCanceling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [balanceCents, setBalanceCents] = useState(0);
  const [creditEntries, setCreditEntries] = useState<any[]>([]);
  const [customAmount, setCustomAmount] = useState('');
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [creditMessage, setCreditMessage] = useState('');

  async function loadCredits() {
    const res = await fetch('/api/billing/credits');
    if (res.ok) {
      const data = await res.json();
      setBalanceCents(data.balanceCents ?? 0);
      setCreditEntries(data.entries ?? []);
    }
  }

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => setUser(d.user));
    loadCredits();
  }, []);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (searchParams.get('topup') !== 'success' || !sessionId) return;
    let active = true;
    (async () => {
      const res = await fetch('/api/billing/topup/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }),
      });
      if (!active) return;
      const data = await res.json();
      setCreditMessage(res.ok ? 'Payment received. Your account credit is ready.' : data.error || 'Payment confirmation is still processing.');
      await loadCredits();
      window.history.replaceState({}, '', '/dashboard/billing');
    })();
    return () => { active = false; };
  }, [searchParams]);

  async function handleTopUp(amount: number) {
    if (!Number.isInteger(amount) || amount < 5 || amount > 500) {
      setCreditMessage('Enter an amount from $5 to $500.');
      return;
    }
    setTopUpLoading(true);
    setCreditMessage('');
    try {
      const res = await fetch('/api/billing/topup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amountCents: amount * 100 }),
      });
      const data = await res.json();
      if (data.url) window.location.assign(data.url);
      else setCreditMessage(data.error || 'Could not start checkout.');
    } catch {
      setCreditMessage('Could not connect to checkout. Please try again.');
    } finally {
      setTopUpLoading(false);
    }
  }

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
        <h1 className="dash-page-title">Billing</h1>
        <p className="dash-page-sub">
          Current plan: <span className="dash-plan-badge">{user?.plan?.name || 'Free'}</span>
        </p>
      </div>

      <section className="dash-card" aria-labelledby="account-credit-title" style={{ marginBottom: 24, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div className="dash-card-title" id="account-credit-title">Account credit</div>
            <p className="text-13 text-muted mb-16">Add funds securely with Stripe. Your credit balance is shown here.</p>
            <div aria-live="polite" style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.04em' }}>
              ${(balanceCents / 100).toFixed(2)} <span className="text-13 text-muted" style={{ fontWeight: 400, letterSpacing: 0 }}>USD</span>
            </div>
          </div>
          <div style={{ minWidth: 260, flex: '1 1 320px', maxWidth: 480 }}>
            <p className="text-13 text-muted mb-16">Choose an amount</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              {[10, 25, 50].map((amount) => (
                <button key={amount} className="btn-border" disabled={topUpLoading} onClick={() => handleTopUp(amount)}>${amount}</button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleTopUp(Number(customAmount)); }} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <label htmlFor="custom-credit" className="sr-only">Custom amount in dollars</label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8, padding: '0 10px', flex: '1 1 120px' }}>
                <span aria-hidden="true">$</span><input id="custom-credit" type="number" min="5" max="500" step="1" required value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} placeholder="Custom" style={{ background: 'transparent', border: 0, padding: '10px 8px', color: 'inherit', width: '100%', outline: 'none' }} />
              </div>
              <button className="btn-accent" disabled={topUpLoading}>{topUpLoading ? 'Opening…' : 'Add credit'}</button>
            </form>
            <p className="text-13 text-muted" style={{ marginTop: 10 }}>Custom top-ups: $5–$500 USD. API usage deductions will be added separately.</p>
          </div>
        </div>
        {creditMessage && <p role="status" className="text-13" style={{ marginTop: 14 }}>{creditMessage}</p>}
        {creditEntries.length > 0 && (
          <div style={{ marginTop: 22, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div className="text-13" style={{ fontWeight: 600, marginBottom: 10 }}>Recent credit activity</div>
            {creditEntries.slice(0, 5).map((entry) => (
              <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', fontSize: 13 }}>
                <span className="text-muted">{entry.type === 'account_credit_refund' ? 'Refund' : 'Top-up'} · {new Date(entry.createdAt).toLocaleDateString()}</span>
                <strong>{entry.amountCents < 0 ? '−' : '+'}${(Math.abs(entry.amountCents) / 100).toFixed(2)}</strong>
              </div>
            ))}
          </div>
        )}
      </section>

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

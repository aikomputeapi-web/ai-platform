import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo forever',
    desc: 'Evaluate the platform. No credit card required.',
    features: ['50 requests/month', '2 API keys', 'Free-tier models', 'Basic analytics', 'Community support'],
    cta: 'Get Started',
    href: '/signup',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$20',
    period: '/month',
    desc: 'For individual developers shipping with AI.',
    features: ['High capacity', '5 API keys', 'Claude + GPT + Gemini', 'Priority routing', 'Webhooks', 'Email support'],
    cta: 'Subscribe',
    href: '/signup',
    highlight: true,
  },
  {
    name: 'Max 5x',
    price: '$100',
    period: '/month',
    desc: '5x the capacity for power users.',
    features: ['5x Pro capacity', '10 API keys', 'All flagship models', 'Elevated priority', 'Webhooks + logs', 'Priority support'],
    cta: 'Subscribe',
    href: '/signup',
    highlight: false,
  },
  {
    name: 'Max 20x',
    price: '$200',
    period: '/month',
    desc: 'Maximum throughput for teams.',
    features: ['20x Pro capacity', '20 API keys', 'All flagship models', 'Highest priority', 'SLA guarantee', 'Dedicated support'],
    cta: 'Contact Us',
    href: '/signup',
    highlight: false,
  },
];

const COMPARISON = [
  { feature: 'Monthly requests', free: '50', pro: '10,000', max5x: '50,000', max20x: '200,000' },
  { feature: 'Concurrent requests', free: '1', pro: '5', max5x: '25', max20x: '100' },
  { feature: 'API keys', free: '2', pro: '5', max5x: '10', max20x: '20' },
  { feature: 'Model access', free: 'Free-tier', pro: 'All models', max5x: 'All models', max20x: 'All models' },
  { feature: 'Routing priority', free: 'Standard', pro: 'Standard', max5x: 'Elevated', max20x: 'Highest' },
  { feature: 'Smart fallbacks', free: '--', pro: 'Yes', max5x: 'Yes', max20x: 'Yes' },
  { feature: 'Webhooks', free: '--', pro: 'Yes', max5x: 'Yes', max20x: 'Yes' },
  { feature: 'Email support', free: '--', pro: 'Yes', max5x: 'Priority', max20x: 'Dedicated' },
  { feature: 'SLA', free: '--', pro: '--', max5x: '--', max20x: '99%' },
];

export default function PricingPage() {
  return (
    <div className="page-shell">
      <Header />

      <div className="page-hero">
        <div className="hero-tag mb-16">PRICING</div>
        <h1 className="heading-hero">
          Simple, transparent<br />pricing.
        </h1>
        <p className="hero-desc text-max-480">
          Start free. Scale as you grow. No hidden fees, no surprises.
        </p>
      </div>

      <div className="pricing-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', borderBottom: '1px solid var(--border-bright)' }}>
        {PLANS.map((plan) => (
          <div key={plan.name} className={`pricing-card ${plan.highlight ? 'highlight' : ''} flex flex-col`}>
            <div className="pricing-name">
              {plan.highlight && <span className="text-accent" style={{ marginRight: '8px' }}>★</span>}{plan.name}
            </div>
            <div className="pricing-amount">
              {plan.price}
              <span className="period">{plan.period}</span>
            </div>
            <p className="pricing-desc mt-12">{plan.desc}</p>
            <Link href={plan.href} className={plan.highlight ? 'btn-accent' : 'btn-outline'} style={{ marginTop: 'auto', textAlign: 'center' }}>
              {plan.cta} →
            </Link>
            <ul className="flex flex-col gap-12 mt-32" style={{ listStyle: 'none' }}>
              {plan.features.map(f => (
                <li key={f} className="text-13 text-muted flex-center gap-8">
                  <span className="text-accent" style={{ fontSize: '8px' }}>●</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="page-section">
        <div className="mono text-10 uppercase text-muted mb-24" style={{ letterSpacing: '0.12em' }}>
          PLAN COMPARISON
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Free</th>
                <th className="text-accent">Pro</th>
                <th>Max 5x</th>
                <th>Max 20x</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.feature}>
                  <td className="font-600">{row.feature}</td>
                  <td className="mono">{row.free}</td>
                  <td className="mono text-bright">{row.pro}</td>
                  <td className="mono">{row.max5x}</td>
                  <td className="mono">{row.max20x}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-16 footnote">
          Usage is billed at cost per million tokens. Check individual model pages for per-model pricing.
        </p>
      </div>

      <div className="page-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1px', background: 'var(--border-bright)' }}>
        <div className="bg-bg flex flex-col justify-center" style={{ padding: '32px' }}>
          <div className="mono text-10 uppercase text-accent mb-8" style={{ letterSpacing: '0.12em' }}>● FAQ</div>
          <h3 className="text-20 font-700 uppercase" style={{ letterSpacing: '0.02em', lineHeight: 1.1 }}>Frequently Asked</h3>
        </div>
        {[
          { q: 'Can I cancel anytime?', a: 'Yes. Cancel from your dashboard and your subscription remains active until the end of the billing period.' },
          { q: 'What counts as a request?', a: 'Each chat completion or API call counts as one request. Streaming counts the same as non-streaming.' },
          { q: 'Do unused requests roll over?', a: 'No. Monthly quotas reset at the start of each billing cycle.' },
          { q: 'Can I change plans?', a: 'Yes — upgrade or downgrade anytime. Changes take effect immediately with prorated billing.' },
        ].map(({ q, a }) => (
          <div key={q} className="bg-bg" style={{ padding: '32px' }}>
            <div className="mono text-12 font-700 text-bright mb-12">{q}</div>
            <p className="text-13 text-muted" style={{ lineHeight: 1.7 }}>{a}</p>
          </div>
        ))}
      </div>

      <Footer />
    </div>
  );
}

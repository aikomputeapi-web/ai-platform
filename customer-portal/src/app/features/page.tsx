import Link from 'next/link';
import { MODELS } from '@/lib/models';

const PROVIDERS = [
  { name: 'OpenAI',    latency: '1.2s', uptime: '99.9%' },
  { name: 'Anthropic', latency: '0.9s', uptime: '99.8%' },
  { name: 'Google',    latency: '0.4s', uptime: '99.9%' },
  { name: 'DeepSeek',  latency: '1.9s', uptime: '97.2%' },
  { name: 'xAI',       latency: '0.6s', uptime: '99.7%' },
  { name: 'Meta',      latency: '0.5s', uptime: '99.6%' },
  { name: 'Mistral',   latency: '0.8s', uptime: '99.5%' },
  { name: 'Moonshot',  latency: '0.7s', uptime: '99.4%' },
];

const RULES = [
  { if: 'latency_budget < 500ms', then: `Route to ${MODELS.GOOGLE_FLASH}` },
  { if: 'task_type = "code"',     then: `Prefer ${MODELS.ANTHROPIC_SONNET}` },
  { if: 'cost > $0.01',           then: `Fallback to ${MODELS.DEEPSEEK_V3}` },
  { if: 'user_tier = "enterprise"', then: `Pin to ${MODELS.OPENAI_FLAGSHIP}` },
];

export default function FeaturesPage() {
  return (
    <div className="page-shell">

      {/* NAV */}
      <nav className="site-nav">
        <Link href="/" className="nav-brand">AIKO<span>MPUTE</span></Link>

        <div className="nav-links">
          {[
            { href: '/models', label: 'MODELS' },
            { href: '/features', label: 'FEATURES', active: true },
            { href: '/pricing', label: 'PRICING' },
            { href: '/docs', label: 'DOCS' },
          ].map(({ href, label, active }) => (
            <Link key={href} href={href} style={{ color: active ? 'var(--accent)' : undefined }}>{label}</Link>
          ))}
        </div>

        <div className="nav-right">
          <Link href="/login" className="nav-signin">SIGN IN</Link>
          <Link href="/signup" className="nav-cta">START FREE →</Link>
        </div>
      </nav>

      {/* Page header */}
      <div className="page-hero-sm">
        <div className="eyebrow-accent">● PLATFORM</div>
        <h1 className="heading-page">Features</h1>
        <p className="text-muted text-15 text-max-480">
          Real-time provider health monitoring, intelligent routing rules, and automatic failover.
        </p>
      </div>

      {/* Provider health grid */}
      <div className="border-bottom">
        <div className="section-label-bar">01 — Provider Health</div>
        <div className="feature-grid">
          {PROVIDERS.map((p, i) => (
            <div key={p.name} className="provider-card" style={{
              padding: '32px 28px',
              borderRight: i % 4 < 3 ? '1px solid var(--border-bright)' : 'none',
              borderBottom: i < 4 ? '1px solid var(--border-bright)' : 'none',
            }}>
              <div className="text-15 font-600 mb-16">{p.name}</div>
              <div className="flex-between text-12 text-muted mb-6">
                <span>latency</span>
                <span className="mono text-bright">{p.latency}</span>
              </div>
              <div className="flex-between text-12 text-muted">
                <span>uptime</span>
                <span className="mono text-accent">{p.uptime}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Routing rules */}
      <div className="border-bottom" style={{ padding: '0 0 48px' }}>
        <div className="section-label-bar" style={{ marginBottom: '32px' }}>02 — Routing Rules</div>
        <div className="feature-grid" style={{ background: 'var(--border-bright)', gap: '1px', padding: '0 64px' }}>
          {RULES.map((r, i) => (
            <div key={i} className="routing-rule bg-bg" style={{ padding: '28px 24px' }}>
              <div className="mono text-10 mb-8 uppercase text-muted" style={{ letterSpacing: '0.1em' }}>IF</div>
              <div className="mono text-accent" style={{ fontSize: '13px', marginBottom: '16px' }}>{r.if}</div>
              <div className="mono text-10 mb-8 uppercase text-muted" style={{ letterSpacing: '0.1em' }}>THEN</div>
              <div className="mono text-bright" style={{ fontSize: '13px' }}>{r.then}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="footer-bottom">
        <span>© 2026 AIKOMPUTE INC.</span>
        <div className="flex gap-24">
          <Link href="/terms" className="text-muted" style={{ textDecoration: 'none' }}>Terms</Link>
          <Link href="/privacy" className="text-muted" style={{ textDecoration: 'none' }}>Privacy</Link>
        </div>
      </div>
    </div>
  );
}
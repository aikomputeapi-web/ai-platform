import Link from 'next/link';
import { Suspense } from 'react';
import { MODEL_CATALOGUE } from '@/lib/models';
import { getModelMetrics } from '@/lib/artificialanalysis';

export const revalidate = 3600;

export const metadata = {
  title: 'Models — aikompute',
  description: 'All Anthropic and OpenAI models, plus all the top open source models are included.',
};

async function MetricsTable() {
  const metrics = await getModelMetrics();

  return (
    <table className="dash-table">
      <thead>
        <tr>
          <th style={{ textAlign: 'left', fontWeight: 400 }}>Model</th>
          <th style={{ textAlign: 'right', fontWeight: 400 }}>Tokens/s</th>
          <th style={{ textAlign: 'right', fontWeight: 400 }}>$/1M</th>
        </tr>
      </thead>
      <tbody>
        {metrics.map((m) => (
          <tr key={m.id}>
            <td style={{ padding: '12px 16px', fontSize: '14px' }}>{m.name}</td>
            <td className="mono text-muted text-13" style={{ padding: '12px 16px', textAlign: 'right' }}>{m.outputSpeed ?? '—'}</td>
            <td className="mono text-muted text-13" style={{ padding: '12px 16px', textAlign: 'right' }}>${m.blendedPrice ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ModelsPage() {
  return (
    <div className="page-shell">

      {/* NAV */}
      <nav className="site-nav">
        <Link href="/" className="nav-brand">
          AIKO<span>MPUTE</span>
        </Link>
        <div className="nav-links">
          {[
            { href: '/models', label: 'MODELS', active: true },
            { href: '/features', label: 'FEATURES' },
            { href: '/pricing', label: 'PRICING' },
            { href: '/docs', label: 'DOCS' },
          ].map(({ href, label, active }) => (
            <Link key={href} href={href} style={{ color: active ? 'var(--accent)' : undefined }}>
              {label}
            </Link>
          ))}
        </div>
        <div className="nav-right">
          <Link href="/login" className="nav-signin">SIGN IN</Link>
          <Link href="/signup" className="nav-cta">START FREE →</Link>
        </div>
      </nav>

      {/* Page header */}
      <div className="page-hero-sm">
        <div className="eyebrow-accent">● LIVE CATALOGUE</div>
        <h1 className="heading-page">
          {MODEL_CATALOGUE.length}+<br />
          <span style={{ WebkitTextStroke: '1.5px var(--text)', color: 'transparent' }}>MODELS</span>
        </h1>
        <p className="text-muted text-15 text-max-480">
          Every frontier model available via a single OpenAI-compatible endpoint.
          Live performance metrics updated hourly.
        </p>
      </div>

      {/* Metrics table */}
      <div className="border-bottom">
        <div className="section-label-bar">Live Performance Benchmarks</div>
        <div style={{ padding: '0 48px' }}>
          <Suspense fallback={
            <div className="p-12 text-muted mono text-12">
              Loading metrics...
            </div>
          }>
            <MetricsTable />
          </Suspense>
        </div>
      </div>

      {/* Model grid */}
      <div className="feature-grid" style={{ borderBottom: '1px solid var(--border-bright)' }}>
        {MODEL_CATALOGUE.map((m) => (
          <div key={m.key} className="model-card" style={{
            padding: '28px 24px',
            borderRight: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
          }}>
            <div className="mono text-9 text-accent mb-8 uppercase" style={{ letterSpacing: '0.12em' }}>{m.provider}</div>
            <div className="text-14 font-600 text-bright mb-8">{m.name}</div>
            <code className="mono text-10 text-muted break-all">{m.id}</code>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="site-footer">
        <div className="footer-col" style={{ padding: '40px 32px' }}>
          <div className="footer-brand" style={{ fontSize: '16px' }}>
            AIKO<span>MPUTE</span>
          </div>
           <p className="footer-tagline">All Anthropic & OpenAI models, plus top open source.</p>
        </div>
        {[
          { title: 'Product', links: [{ href: '/models', label: 'Models' }, { href: '/features', label: 'Features' }, { href: '/pricing', label: 'Pricing' }] },
          { title: 'Developers', links: [{ href: '/docs', label: 'API Ref' }, { href: '/quickstart', label: 'Quickstart' }, { href: '/guides', label: 'Guides' }] },
          { title: 'Company', links: [{ href: '/faq', label: 'FAQ' }, { href: '/support', label: 'Support' }, { href: '/privacy', label: 'Privacy' }, { href: '/terms', label: 'Terms' }] },
        ].map(({ title, links }) => (
          <div key={title} className="footer-col" style={{ padding: '40px 32px' }}>
            <h5>{title}</h5>
            {links.map(({ href, label }) => (
              <Link key={label} href={href} className="footer-link" style={{ marginBottom: '10px' }}>{label}</Link>
            ))}
          </div>
        ))}
      </footer>
      <div className="footer-bottom">
        <span>© 2026 AIKOMPUTE INC.</span><span>ALL ANTHROPIC & OPENAI. PLUS TOP OPEN SOURCE.</span>
      </div>
    </div>
  );
}
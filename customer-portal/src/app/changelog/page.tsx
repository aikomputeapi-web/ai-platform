import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const ENTRIES = [
  {
    date: 'June 29, 2026',
    version: 'v1.0.4',
    changes: [
      { type: 'feature', text: 'AI coding tool setup guides: Cursor, Windsurf, Trae, Cline, Kilocode, Open Hands, Zoo Code, Continue, Aider, CodeGPT, Claude Code, Codex at /guides' },
      { type: 'feature', text: 'Fixed dashboard docs Base URL from aikompute.com to api.aikompute.com' },
    ],
  },
  {
    date: 'June 25, 2026',
    version: 'v1.0.3',
    changes: [
      { type: 'feature', text: 'Public pricing page launched at /pricing' },
      { type: 'feature', text: 'Quickstart guide with multi-language examples at /quickstart' },
      { type: 'feature', text: 'Integration guides for Python, Node.js, Go, Ruby, Java at /guides' },
      { type: 'feature', text: 'Full API reference docs with endpoint specs and error codes' },
      { type: 'feature', text: 'FAQ, support, and changelog pages' },
      { type: 'fix', text: 'Fixed email verification flow for OAuth signups' },
    ],
  },
  {
    date: 'June 18, 2026',
    version: 'v1.0.2',
    changes: [
      { type: 'feature', text: 'Rate limiting implementation with Redis-backed counters' },
      { type: 'feature', text: 'Subscription tier enforcement for Pro, Max 5x, Max 20x' },
      { type: 'feature', text: 'Rate limit response headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)' },
      { type: 'fix', text: 'Improved 429 handling with automatic fallback to next available model' },
    ],
  },
  {
    date: 'June 10, 2026',
    version: 'v1.0.1',
    changes: [
      { type: 'feature', text: 'Account pooling subsystem: sticky sessions, anti-detection, smart pool' },
      { type: 'feature', text: 'Socks5 proxy support for IP rotation (Bright Data, Smartproxy, Oxylabs)' },
      { type: 'feature', text: 'Session persistence with Redis-backed conversation history' },
      { type: 'feature', text: 'AccountPoolManager dashboard component for monitoring backend accounts' },
      { type: 'fix', text: 'Reduced 429 collision rate by 94% via cooldown randomization' },
    ],
  },
  {
    date: 'June 1, 2026',
    version: 'v1.0.0',
    changes: [
      { type: 'feature', text: 'Initial release of aikompute unified AI inference platform' },
      { type: 'feature', text: 'OpenAI-compatible /v1/chat/completions endpoint' },
      { type: 'feature', text: 'Anthropic-compatible /v1/messages endpoint' },
      { type: 'feature', text: 'Multi-provider routing to OpenAI, Anthropic, Google, DeepSeek, xAI, Meta, Mistral' },
      { type: 'feature', text: 'Customer portal with signup, login, OAuth (Google, GitHub)' },
      { type: 'feature', text: 'API key management dashboard with create/revoke' },
      { type: 'feature', text: 'Usage analytics with daily, weekly, monthly views' },
      { type: 'feature', text: 'Stripe billing integration with subscription management' },
      { type: 'feature', text: 'Email verification and password reset flows' },
      { type: 'feature', text: 'Admin dashboard for user and billing management' },
      { type: 'feature', text: 'Live model catalog with performance benchmarks' },
      { type: 'feature', text: 'Docker Compose deployment with Nginx, PostgreSQL, Redis' },
      { type: 'feature', text: 'Let\'s Encrypt SSL with auto-renewal' },
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="page-shell">
      <Header />

      <div className="page-hero">
        <div className="hero-tag mb-16">UPDATES</div>
        <h1 className="heading-hero">
          Changelog
        </h1>
        <p className="hero-desc text-max-480">
          Every release, every improvement. Track what we ship.
        </p>
      </div>

      {ENTRIES.map((entry) => (
        <div key={entry.version} className="border-bottom">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div className="bg-surface" style={{ padding: '32px 64px', borderRight: '1px solid var(--border)' }}>
              <div className="mono text-13 text-accent font-700 mb-4">{entry.version}</div>
              <div className="text-11 text-muted mono">{entry.date}</div>
            </div>
            <div className="page-section-sm">
              <ul className="flex flex-col gap-12" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex-start gap-12 text-14 text-bright">
                    <span className={change.type === 'feature' ? 'badge badge-success' : 'badge badge-warning'} style={{
                      fontSize: '9px', padding: '1px 6px', marginTop: '2px', flexShrink: 0
                    }}>
                      {change.type === 'feature' ? 'NEW' : 'FIX'}
                    </span>
                    <span style={{ lineHeight: 1.4 }}>{change.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ))}

      <Footer />
    </div>
  );
}

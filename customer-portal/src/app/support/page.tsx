import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const CHANNELS = [
  {
    title: 'Email Support',
    desc: 'For billing issues, account questions, and general inquiries.',
    contact: 'support@aikompute.com',
    response: 'Response within 24 hours (Pro: 12h, Max: 4h)',
    icon: '✉',
  },
  {
    title: 'Documentation',
    desc: 'API reference, quickstart guides, and integration examples.',
    contact: null,
    response: 'Self-service — available 24/7',
    icon: '📚',
    link: { href: '/docs', label: 'Browse Docs →' },
  },
  {
    title: 'FAQ',
    desc: 'Common questions about the platform, billing, and usage.',
    contact: null,
    response: 'Self-service — available 24/7',
    icon: '❓',
    link: { href: '/faq', label: 'View FAQ →' },
  },
  {
    title: 'Service Status',
    desc: 'Real-time uptime and incident information for all providers.',
    contact: null,
    response: 'Live status updates',
    icon: '📊',
    link: { href: '/status', label: 'Check Status →' },
  },
];

export default function SupportPage() {
  return (
    <div className="page-shell">
      <Header />

      <div className="page-hero-sm">
        <div className="eyebrow-accent">● HELP</div>
        <h1 className="heading-page">
          Support
        </h1>
        <p className="text-muted text-15 text-max-480">
          We&apos;re here to help. Choose the channel that works best for you.
        </p>
      </div>

      <div className="page-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', background: 'var(--border-bright)', gap: '1px' }}>
        {CHANNELS.map((channel) => (
          <div key={channel.title} className="bg-bg" style={{ padding: '48px' }}>
            <div className="text-24 mb-16">{channel.icon}</div>
            <h2 className="text-16 font-600 mb-8 uppercase" style={{ letterSpacing: '0.02em' }}>{channel.title}</h2>
            <p className="text-13 text-muted mb-16" style={{ lineHeight: 1.7 }}>{channel.desc}</p>
            {channel.contact && (
              <div className="mono text-13 text-accent mb-8">{channel.contact}</div>
            )}
            <div className="text-11 text-muted">{channel.response}</div>
            {channel.link && (
              <Link href={channel.link.href} className="mono" style={{
                display: 'inline-block', marginTop: '16px',
                padding: '8px 16px', background: 'var(--surface)', color: 'var(--text)',
                fontSize: '11px', border: '1px solid var(--border)', textDecoration: 'none', letterSpacing: '0.04em',
              }}>
                {channel.link.label}
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="page-section bg-surface">
        <h2 className="text-14 font-600 mb-12 uppercase" style={{ letterSpacing: '0.02em' }}>Before you reach out</h2>
        <ul className="text-13 text-muted" style={{ lineHeight: 2, listStyle: 'none', padding: 0 }}>
          <li>→ Check our <Link href="/faq" className="text-accent">FAQ</Link> for instant answers to common questions</li>
          <li>→ Review the <Link href="/docs" className="text-accent">API documentation</Link> for endpoint reference</li>
          <li>→ Check <Link href="/status" className="text-accent">service status</Link> for ongoing incidents</li>
          <li>→ Include your account email and any error messages in your support request</li>
        </ul>
      </div>

      <Footer />
    </div>
  );
}

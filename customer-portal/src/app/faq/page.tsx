import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const FAQS = [
  {
    q: 'What is AIKOMPUTE?',
    a: 'We provide all Anthropic and OpenAI models, plus all the top open source models are included. Route your requests intelligently across OpenAI, Anthropic, Google, DeepSeek, xAI, Meta, Mistral, and more — all through a single OpenAI-compatible endpoint.',
  },
  {
    q: 'How is this different from using OpenAI directly?',
    a: 'You get access to every major model through one API key and one bill. Smart routing automatically picks the best model for your task, with fallback if a provider is degraded.',
  },
  {
    q: 'Do I need to change my code?',
    a: 'No. AIKOMPUTE is fully OpenAI-compatible. Just swap your baseURL to https://api.aikompute.com/v1 and pass your API key. No new SDKs or code changes needed.',
  },
  {
    q: 'How do I get started?',
    a: 'Sign up for free, generate an API key from the dashboard, and make your first request. The free tier includes 50 requests — no credit card required.',
  },
  {
    q: 'What models are available?',
    a: 'All Anthropic and OpenAI models are available, plus all the top open source models. Browse the full catalog to see everything we support.',
  },
  {
    q: 'How does pricing work?',
    a: "We offer subscription plans (Free, Pro $5/mo, Max 5x $20/mo, Max 20x $40/mo). Usage limits align with Anthropic's subscription tier limits (and 5x or 20x of that respectively). Usage is billed at cost per million tokens.",
  },
  {
    q: 'What counts as a request?',
    a: 'Each API call to /v1/chat/completions or /v1/messages counts as one request. Streaming requests count the same as non-streaming.',
  },
  {
    q: 'Do unused requests roll over?',
    a: 'No. Monthly quotas reset at the start of each billing cycle.',
  },
  {
    q: 'Can I cancel my subscription?',
    a: 'Yes, cancel anytime from the billing page. Your subscription remains active until the end of the current billing period.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. We do not store AI request content or model outputs. API calls are proxied in real-time. We do not train models on your data. See our privacy policy for details.',
  },
  {
    q: 'Do you support streaming?',
    a: 'Yes. Set stream: true in your request body to receive server-sent events (SSE). Works with any OpenAI-compatible streaming client.',
  },
  {
    q: 'What happens when a provider is down?',
    a: 'Our routing layer automatically detects provider degradation and falls back to the next best available model. You may see slightly different responses during failover.',
  },
  {
    q: 'Can I use this in production?',
    a: 'Subscriptions are for personal use in coding and software development. For production or enterprise use, contact us to discuss custom plans.',
  },
];

export default function FAQPage() {
  return (
    <div className="bg-bg flex flex-col" style={{ minHeight: '100vh', color: 'var(--text)' }}>
      <Header />

      <div style={{ padding: '72px 64px 48px', borderBottom: '1px solid var(--border-bright)' }}>
        <div className="hero-tag mb-16">HELP</div>
        <h1 className="font-700 uppercase" style={{ fontSize: 'clamp(36px, 5.5vw, 64px)', letterSpacing: '-0.03em', lineHeight: 0.95, marginBottom: '20px' }}>
          Frequently Asked<br />Questions.
        </h1>
        <p className="hero-desc" style={{ maxWidth: '480px' }}>
          Everything you need to know about AIKOMPUTE. Can&apos;t find what you&apos;re looking for? <Link href="/support" className="text-accent">Contact support →</Link>
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1px', background: 'var(--border-bright)' }}>
        {FAQS.map(({ q, a }) => (
          <div key={q} className="bg-bg" style={{ padding: '32px 48px', borderBottom: '1px solid var(--border)' }}>
            <div className="mono text-13 font-700 text-bright mb-12">{q}</div>
            <p className="text-14 text-muted" style={{ lineHeight: 1.7 }}>{a}</p>
          </div>
        ))}
      </div>

      <div className="text-center" style={{ padding: '48px 64px', borderBottom: '1px solid var(--border-bright)' }}>
        <p className="mono text-14 text-muted mb-16">Still have questions?</p>
        <Link href="/support" className="btn-accent">
          Contact Support →
        </Link>
      </div>

      <Footer />
    </div>
  );
}

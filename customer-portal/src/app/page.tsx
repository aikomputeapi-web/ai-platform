import Link from 'next/link';
import { MODELS } from '@/lib/models';

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--color-border)] bg-[rgba(10,10,15,0.8)] backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight">AI API Platform</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/features" className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors">Features</Link>
            <Link href="/models" className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors">Models</Link>
            <Link href="/docs" className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors">Docs</Link>
            <Link href="#pricing" className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors">Pricing</Link>
            <Link href="/login" className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors">Sign In</Link>
            <Link href="/signup" className="btn-primary py-2 px-4 text-sm">Get Started</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] opacity-15 pointer-events-none" style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)', filter: 'blur(120px)' }} />
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] text-xs font-semibold uppercase tracking-wider mb-8 border border-[rgba(99,102,241,0.2)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-accent)]"></span>
            </span>
            Now live: {MODELS.OPENAI_FLAGSHIP} · {MODELS.ANTHROPIC_OPUS} · {MODELS.GOOGLE_PRO}
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
            Smart AI Routing.{' '}<br className="hidden md:block" />
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #6366f1, #3b82f6)' }}>
              Every Frontier Model.
            </span>
          </h1>
          <p className="text-xl text-[var(--color-text-secondary)] mb-12 max-w-3xl mx-auto leading-relaxed">
            One OpenAI-compatible API endpoint. Automatic failover, cost-optimized routing, and real-time model health monitoring — at prices significantly below direct lab pricing.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/signup" className="btn-primary text-lg px-8 py-4 w-full sm:w-auto shadow-lg shadow-indigo-500/20">
              Start Building for Free
            </Link>
            <Link href="/models" className="btn-secondary text-lg px-8 py-4 w-full sm:w-auto">
              View All Models
            </Link>
          </div>

          {/* Live routing diagram — animated stat bar */}
          <div className="glass-card p-6 max-w-3xl mx-auto text-left">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Live Router Status</span>
              <span className="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                All Systems Operational
              </span>
            </div>
            <div className="space-y-3">
              {[
                { name: MODELS.OPENAI_FLAGSHIP,  provider: 'OpenAI',    latency: '1.2s', tps: '89 t/s',  status: 'green', pct: 88 },
                { name: MODELS.ANTHROPIC_SONNET, provider: 'Anthropic', latency: '0.9s', tps: '112 t/s', status: 'green', pct: 95 },
                { name: MODELS.GOOGLE_FLASH,     provider: 'Google',    latency: '0.4s', tps: '210 t/s', status: 'green', pct: 99 },
                { name: MODELS.DEEPSEEK_V3,      provider: 'DeepSeek',  latency: '1.4s', tps: '68 t/s',  status: 'yellow', pct: 78 },
              ].map((m, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.status === 'green' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                  <span className="text-sm font-medium text-white w-40 truncate">{m.name}</span>
                  <div className="flex-1 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={{ width: `${m.pct}%` }} />
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)] w-14 text-right">{m.tps}</span>
                  <span className="text-xs text-[var(--color-text-muted)] w-10 text-right">{m.latency}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Performance metrics row */}
      <section className="py-12 border-y border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Models Available',     value: '100+',   sub: 'frontier & open weights' },
              { label: 'Avg Cost Savings',     value: '~40%',   sub: 'vs direct lab pricing' },
              { label: 'Uptime SLA',           value: '99.9%',  sub: 'with automatic failover' },
              { label: 'Providers Monitored',  value: '20+',    sub: 'real-time health checks' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="stat-value text-3xl md:text-4xl mb-1">{stat.value}</div>
                <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-0.5">{stat.label}</div>
                <div className="text-xs text-[var(--color-text-muted)]">{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Leaderboard teaser */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2">Intelligence Rankings · Live Data</p>
              <h2 className="text-3xl font-bold">Powered by Independent Benchmarks</h2>
              <p className="text-[var(--color-text-secondary)] mt-2 max-w-xl">
                We integrate live benchmark data from <a href="https://artificialanalysis.ai" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Artificial Analysis</a> so you always know which model is best for your task — and we provide access to every single one.
              </p>
            </div>
            <Link href="/models" className="btn-primary py-2.5 px-6 text-sm whitespace-nowrap flex-shrink-0">
              Explore All Models →
            </Link>
          </div>

          {/* Embedded live chart */}
          <div className="glass-card overflow-hidden mb-6" style={{ height: '440px' }}>
            <iframe
              src="https://artificialanalysis.ai/leaderboards/models?embed=1&theme=dark&metric=intelligence"
              className="w-full h-full border-0"
              title="AI Model Intelligence Leaderboard"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
          <p className="text-xs text-[var(--color-text-muted)] text-center">
            Live chart from <a href="https://artificialanalysis.ai" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">artificialanalysis.ai</a> — updates automatically as new models are benchmarked.
          </p>
        </div>
      </section>

      {/* Code Demo */}
      <section className="py-20 bg-[var(--color-bg-secondary)] border-y border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div className="animate-slide-in">
            <h2 className="text-3xl font-bold mb-6">Drop-in Replacement for OpenAI</h2>
            <p className="text-[var(--color-text-secondary)] text-lg mb-8 leading-relaxed">
              100% compatible with the OpenAI SDK. Just swap your <code className="text-indigo-400 bg-indigo-400/10 px-1.5 rounded text-sm">baseURL</code> and instantly unlock {MODELS.ANTHROPIC_OPUS}, {MODELS.GOOGLE_PRO}, {MODELS.DEEPSEEK_V3}, and more — without changing a single line of your application code.
            </p>
            <ul className="space-y-4">
              {[
                'Automatic failover when a provider goes down',
                'Cost-optimized routing across 20+ providers',
                'Real-time model availability and latency metrics',
                'Unified billing — one invoice for all models',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-[var(--color-text-primary)] font-medium">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-success)]/10 flex items-center justify-center text-[var(--color-success)] text-sm flex-shrink-0">✓</div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass-card p-6 border-[var(--color-border)] relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--color-border)]">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" /><div className="w-3 h-3 rounded-full bg-yellow-500/80" /><div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-xs text-[var(--color-text-muted)] font-mono">app.js</span>
            </div>
            <pre className="text-sm font-mono text-[var(--color-text-primary)] overflow-x-auto leading-relaxed">
              <span className="text-purple-400">import</span> OpenAI <span className="text-purple-400">from</span> <span className="text-green-400">'openai'</span>;{'\n\n'}
              <span className="text-[var(--color-text-muted)]">{'// 1. Just change baseURL + key'}</span>{'\n'}
              <span className="text-purple-400">const</span> client = <span className="text-purple-400">new</span> OpenAI({'('}&#123;{'\n'}
              {'  '}apiKey: <span className="text-green-400">'your_api_key'</span>,{'\n'}
              {'  '}baseURL: <span className="text-green-400">'https://aikompute.com/v1'</span>{'\n'}
              &#125;{')'}{')'};{'\n\n'}
              <span className="text-[var(--color-text-muted)]">{'// 2. Access ANY frontier model'}</span>{'\n'}
              <span className="text-purple-400">const</span> res = <span className="text-purple-400">await</span> client.chat.completions.create({'('}&#123;{'\n'}
              {'  '}model: <span className="text-green-400">{`'${MODELS.ANTHROPIC_SONNET_ID}'`}</span>,{'\n'}
              {'  '}messages: [&#123; role: <span className="text-green-400">'user'</span>, content: <span className="text-green-400">'Hello!'</span> &#125;]{'\n'}
              &#125;{')'}{')'};
            </pre>
          </div>
        </div>
      </section>

      {/* Routing features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Intelligent Routing Infrastructure</h2>
            <p className="text-[var(--color-text-secondary)] text-lg max-w-2xl mx-auto">
              Our router continuously monitors every provider and automatically selects the optimal backend for each request.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: '🔀', title: 'Cost-Optimized Routing',     desc: 'Automatically routes to the lowest-cost provider that meets your latency threshold, saving up to 40% vs direct lab pricing.' },
              { icon: '🛡️', title: 'Automatic Failover',        desc: 'If a provider returns an error or goes down, requests are instantly retried on a healthy alternative — zero downtime for your users.' },
              { icon: '📊', title: 'Real-Time Health Dashboard', desc: 'Monitor provider availability, P50/P99 latency, and error rates for every model and provider from a live admin dashboard.' },
              { icon: '⚙️', title: 'Custom Routing Rules',      desc: 'Pin specific users or request types to specific models or providers. Define fallback chains that match your cost and quality requirements.' },
              { icon: '🔑', title: 'Virtual API Keys',          desc: 'Issue per-user API keys with fine-grained rate limits, spending caps, and model allowlists — all managed from one dashboard.' },
              { icon: '📈', title: 'Usage Analytics',           desc: 'Per-key and per-model usage tracking with token counts, costs, and latency breakdowns. Export to CSV or query via API.' },
            ].map((f, i) => (
              <div key={i} className="glass-card p-6">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-white text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
          <p className="text-[var(--color-text-secondary)] text-lg mb-16 max-w-2xl mx-auto">
            Start free. Upgrade for higher limits and dedicated throughput.
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto text-left">
            {[
              { name: 'Free',  price: '$0',  desc: 'Perfect for prototyping', features: ['100 requests/day', '5 req/min rate limit', 'Free-tier models only', 'Community support'], featured: false },
              { name: 'Basic', price: '$19', desc: 'For indie hackers', features: ['1,000 requests/day', '20 req/min rate limit', `All models incl. ${MODELS.OPENAI_FLAGSHIP}`, 'Email support'], featured: true },
              { name: 'Pro',   price: '$49', desc: 'For scaling startups', features: ['10,000 requests/day', '60 req/min rate limit', 'Priority routing', 'Dedicated support'], featured: false },
            ].map((plan, i) => (
              <div key={i} className={`glass-card p-8 relative flex flex-col ${plan.featured ? 'ring-2 ring-[var(--color-accent)] md:-translate-y-4' : ''}`}>
                {plan.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 badge-accent px-4 py-1">Most Popular</div>}
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <p className="text-[var(--color-text-secondary)] text-sm mb-6">{plan.desc}</p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-[var(--color-text-muted)]">/month</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm">
                      <span className="text-[var(--color-success)] mt-0.5">✓</span>
                      <span className="text-[var(--color-text-secondary)]">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className={plan.featured ? 'btn-primary w-full' : 'btn-secondary w-full'}>Get Started</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-12 text-center text-[var(--color-text-muted)]">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold text-[var(--color-text-primary)]">AI API Platform</span>
        </div>
        <div className="flex items-center justify-center gap-6 text-sm mb-4">
          <Link href="/models" className="hover:text-white transition-colors">Models</Link>
          <Link href="/features" className="hover:text-white transition-colors">Features</Link>
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
        </div>
        <p className="text-xs">© {new Date().getFullYear()} AI API Platform. All rights reserved. Benchmark data from <a href="https://artificialanalysis.ai" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">Artificial Analysis</a>.</p>
      </footer>
    </div>
  );
}

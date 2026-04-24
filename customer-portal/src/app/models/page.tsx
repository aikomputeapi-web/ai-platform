import Link from 'next/link';
import { MODELS, MODEL_CATALOGUE } from '@/lib/models';

export const metadata = {
  title: 'AI Models — aikompute API Platform',
  description: `Access ${MODELS.OPENAI_FLAGSHIP}, ${MODELS.ANTHROPIC_OPUS}, ${MODELS.GOOGLE_PRO}, ${MODELS.DEEPSEEK_V3}, and dozens more frontier AI models through a single unified API — significantly cheaper than going to each lab directly.`,
};

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  frontier: { label: 'Frontier',     color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  standard: { label: 'Standard',     color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  fast:     { label: 'Speed',        color: 'text-green-400 bg-green-400/10 border-green-400/20' },
  open:     { label: 'Open Weights', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
};

export default function ModelsPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--color-border)] bg-[rgba(10,10,15,0.8)] backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight">AI API Platform</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/features" className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors">Features</Link>
            <Link href="/models" className="text-sm font-medium text-white transition-colors border-b-2 border-indigo-500 py-5">Models</Link>
            <Link href="/docs" className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors">Docs</Link>
            <Link href="/login" className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors">Sign In</Link>
            <Link href="/signup" className="btn-primary py-2 px-4 text-sm">Get Started</Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative pt-24 pb-16 overflow-hidden border-b border-[var(--color-border)]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] opacity-15 pointer-events-none" style={{ background: 'radial-gradient(ellipse, #6366f1 0%, transparent 70%)', filter: 'blur(80px)' }} />
          <div className="max-w-5xl mx-auto px-6 text-center relative z-10 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] text-xs font-semibold uppercase tracking-wider mb-6 border border-[rgba(99,102,241,0.2)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-accent)]"></span>
              </span>
              Powered by Artificial Analysis data
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
              Every Frontier Model.{' '}
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #6366f1, #3b82f6)' }}>
                One API.
              </span>
            </h1>
            <p className="text-xl text-[var(--color-text-secondary)] max-w-3xl mx-auto leading-relaxed mb-8">
              Access {MODELS.OPENAI_FLAGSHIP}, {MODELS.ANTHROPIC_OPUS}, {MODELS.GOOGLE_PRO}, {MODELS.DEEPSEEK_V3}, and dozens more — through a single unified endpoint, at prices significantly below direct lab pricing.
            </p>
            <div className="flex items-center justify-center gap-3 text-sm text-[var(--color-text-muted)]">
              <span>Benchmark data sourced from</span>
              <a href="https://artificialanalysis.ai" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                artificialanalysis.ai ↗
              </a>
              <span>— updated live</span>
            </div>
          </div>
        </section>

        {/* Live Leaderboard Embed — Intelligence */}
        <section className="py-16 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2">Live Data · Updated Every 72h</p>
                <h2 className="text-2xl font-bold">Intelligence Leaderboard</h2>
                <p className="text-[var(--color-text-secondary)] mt-1 text-sm">
                  Independent Artificial Analysis Intelligence Index — measures real-world reasoning across coding, science, math, and knowledge.
                </p>
              </div>
              <a
                href="https://artificialanalysis.ai/leaderboards/models"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary py-2 px-4 text-sm whitespace-nowrap flex-shrink-0"
              >
                Full Leaderboard ↗
              </a>
            </div>

            {/* Embedded live chart via iframe — dynamically pulls from artificialanalysis.ai */}
            <div className="glass-card overflow-hidden" style={{ height: '520px' }}>
              <div className="relative w-full h-full">
                <iframe
                  src="https://artificialanalysis.ai/leaderboards/models?embed=1&theme=dark&metric=intelligence"
                  className="w-full h-full border-0"
                  title="Artificial Analysis Intelligence Leaderboard"
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
                {/* Fallback overlay shown if iframe is blocked */}
                <noscript>
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[var(--color-bg-card)] p-8 text-center">
                    <div className="text-4xl">📊</div>
                    <p className="font-bold text-white">Live chart from Artificial Analysis</p>
                    <a href="https://artificialanalysis.ai/leaderboards/models" target="_blank" rel="noopener noreferrer" className="btn-primary py-2 px-6 text-sm">View Leaderboard ↗</a>
                  </div>
                </noscript>
              </div>
            </div>

            <p className="text-xs text-[var(--color-text-muted)] text-center mt-3">
              Chart automatically updates as new models are benchmarked. Source: <a href="https://artificialanalysis.ai" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">artificialanalysis.ai</a>
            </p>
          </div>
        </section>

        {/* Speed vs Price Scatter Chart */}
        <section className="py-16 border-b border-[var(--color-border)]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-green-400 mb-2">Speed · Cost · Quality</p>
                <h2 className="text-2xl font-bold">Speed vs. Price Analysis</h2>
                <p className="text-[var(--color-text-secondary)] mt-1 text-sm">
                  Compare tokens-per-second output speed against blended cost per million tokens for every major model.
                </p>
              </div>
              <a href="https://artificialanalysis.ai" target="_blank" rel="noopener noreferrer" className="btn-secondary py-2 px-4 text-sm whitespace-nowrap flex-shrink-0">
                Explore Full Data ↗
              </a>
            </div>

            <div className="glass-card overflow-hidden" style={{ height: '520px' }}>
              <iframe
                src="https://artificialanalysis.ai/leaderboards/models?embed=1&theme=dark&metric=speed&chart=scatter"
                className="w-full h-full border-0"
                title="Artificial Analysis Speed vs Price"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            </div>

            {/* Static fallback grid showing the data we already know */}
            <div className="mt-8 grid md:grid-cols-3 gap-4">
              {[
                { label: '#1 Intelligence', model: MODELS.OPENAI_FLAGSHIP, score: '60 / 100', color: '#10a37f', icon: '🧠' },
                { label: 'Fastest Model',   model: 'Mercury 2',           score: '677 tok/s',  color: '#f59e0b', icon: '⚡' },
                { label: 'Best Open Weights', model: MODELS.KIMI_FLAGSHIP, score: '54 / 100', color: '#a855f7', icon: '🔓' },
              ].map((stat, i) => (
                <div key={i} className="glass-card p-5 flex items-center gap-4">
                  <div className="text-3xl">{stat.icon}</div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">{stat.label}</p>
                    <p className="font-bold text-white">{stat.model}</p>
                    <p className="text-sm mt-0.5" style={{ color: stat.color }}>{stat.score}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Model Cards Grid */}
        <section className="py-16 border-b border-[var(--color-border)]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-10">
              <h2 className="text-2xl font-bold mb-2">Available Models</h2>
              <p className="text-[var(--color-text-secondary)]">All accessible via a single OpenAI-compatible endpoint. Use any model with the same SDK.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {MODEL_CATALOGUE.map((m) => {
                const tier = TIER_LABELS[m.tier];
                return (
                  <div key={m.key} className="glass-card p-6 flex flex-col gap-4 group hover:scale-[1.01] transition-transform">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{m.provider}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className={`badge border text-[10px] ${tier.color}`}>{tier.label}</span>
                        <span className="badge-accent text-[10px]">{m.badge}</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg leading-snug">{m.name}</h3>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-1.5 leading-relaxed">{m.blurb}</p>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-[var(--color-border)]">
                      <code className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded font-mono">{m.id}</code>
                      <a
                        href={m.aaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--color-text-muted)] hover:text-indigo-400 transition-colors"
                      >
                        Benchmarks ↗
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Why we're cheaper */}
        <section className="py-16 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
          <div className="max-w-5xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-4">Why Cheaper Than the Labs?</h2>
            <p className="text-[var(--color-text-secondary)] text-lg mb-12 max-w-2xl mx-auto">
              We aggregate capacity across multiple providers and routes, passing the savings directly to you.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: '🔄', title: 'Smart Routing', desc: 'Requests are automatically routed to the cheapest available provider that meets your latency requirements.' },
                { icon: '📦', title: 'Bulk Purchasing', desc: 'We pre-purchase token capacity in volume, securing rates that individual developers can\'t access directly.' },
                { icon: '⚖️', title: 'Load Balancing', desc: 'Unused capacity is redistributed in real-time, maximizing utilization and reducing per-token costs.' },
              ].map((item, i) => (
                <div key={i} className="glass-card p-6 text-left">
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <h3 className="font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to connect?</h2>
            <p className="text-[var(--color-text-secondary)] text-lg mb-8">
              One API key. Every model above. Start for free, no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup" className="btn-primary text-base px-8 py-3 w-full sm:w-auto">
                Get Free API Key
              </Link>
              <Link href="/docs" className="btn-secondary text-base px-8 py-3 w-full sm:w-auto">
                Read the Docs
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-10 text-center text-[var(--color-text-muted)]">
        <p className="text-sm">© {new Date().getFullYear()} AI API Platform. All rights reserved. Benchmark data courtesy of <a href="https://artificialanalysis.ai" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">Artificial Analysis</a>.</p>
      </footer>
    </div>
  );
}

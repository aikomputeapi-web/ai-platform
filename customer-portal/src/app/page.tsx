import Link from 'next/link';
import { Suspense } from 'react';
import { MODELS } from '@/lib/models';
import { getLeaderboard } from '@/lib/artificialanalysis';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import RoutingFlow from '@/components/RoutingFlow';
import type { LeaderboardEntry } from '@/lib/artificialanalysis';

// ISR — regenerate this page in the background every hour
export const revalidate = 3600;

// ── Leaderboard sub-component (async server component) ────────────────────────

async function LiveLeaderboard() {
  const entries = await getLeaderboard();
  const top8 = entries.slice(0, 8);
  const maxScore = top8[0]?.intelligenceScore ?? 60;

  return (
    <div className="glass-card p-6 mb-4">
      <div className="space-y-3">
        {top8.map((m: LeaderboardEntry, i: number) => (
          <div key={m.id} className="flex items-center gap-4 group">
            <span className="text-xs text-[var(--color-text-muted)] w-4 font-mono flex-shrink-0">
              {i + 1}
            </span>
            <div className="w-36 flex-shrink-0">
              <p className="text-sm font-semibold text-white truncate">{m.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{m.provider}</p>
            </div>
            <div className="flex-1 h-6 bg-[var(--color-border)] rounded overflow-hidden">
              <div
                className="h-full rounded flex items-center px-2 transition-all duration-700"
                style={{
                  width: `${(m.intelligenceScore / maxScore) * 100}%`,
                  background: `linear-gradient(90deg, ${m.color}88, ${m.color})`,
                }}
              >
                <span className="text-xs font-bold text-white">{m.intelligenceScore}</span>
              </div>
            </div>
            <span className="text-xs text-green-400 font-semibold w-20 text-right flex-shrink-0">
              ✓ Available
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="glass-card p-6 mb-4">
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <span className="w-4 h-3 bg-[var(--color-border)] rounded animate-pulse flex-shrink-0" />
            <div className="w-36 flex-shrink-0 space-y-1">
              <div className="h-3.5 bg-[var(--color-border)] rounded animate-pulse" />
              <div className="h-2.5 w-16 bg-[var(--color-border)] rounded animate-pulse" />
            </div>
            <div className="flex-1 h-6 bg-[var(--color-border)] rounded animate-pulse" />
            <div className="w-20 h-3 bg-[var(--color-border)] rounded animate-pulse flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Routing Decision Log ───────────────────────────────────────────────────────

const LOG_LINES = [
  { ts: '02:14:31.221', type: 'info',    text: `Request received · model: ${MODELS.ANTHROPIC_SONNET_ID}` },
  { ts: '02:14:31.223', type: 'check',   text: 'Primary: Anthropic API — health check...' },
  { ts: '02:14:31.291', type: 'ok',      text: `✓ Anthropic healthy · p50 latency 94ms · $3.00/1M` },
  { ts: '02:14:31.292', type: 'route',   text: `→ Routing to Anthropic (primary match, cost threshold met)` },
  { ts: '02:14:31.294', type: 'info',    text: `Request received · model: ${MODELS.OPENAI_FLAGSHIP_ID}` },
  { ts: '02:14:31.295', type: 'check',   text: 'Primary: OpenAI API — health check...' },
  { ts: '02:14:31.388', type: 'warn',    text: '⚠ OpenAI rate limit detected (429) — triggering failover' },
  { ts: '02:14:31.390', type: 'check',   text: `Failover: trying ${MODELS.ANTHROPIC_OPUS_ID} (Anthropic)...` },
  { ts: '02:14:31.441', type: 'ok',      text: '✓ Anthropic healthy — failover successful (+53ms overhead)' },
  { ts: '02:14:31.443', type: 'route',   text: '→ Request delivered · 0 errors surfaced to client' },
];

const LOG_COLORS: Record<string, string> = {
  info:  'text-[var(--color-text-muted)]',
  check: 'text-blue-400',
  ok:    'text-green-400',
  route: 'text-indigo-400 font-semibold',
  warn:  'text-yellow-400',
};

function RoutingDecisionLog() {
  return (
    <div className="terminal-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          <span className="text-xs text-[var(--color-text-muted)] font-mono ml-2">router.log</span>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Live
        </span>
      </div>
      <div className="space-y-1.5 font-mono text-xs leading-relaxed">
        {LOG_LINES.map((line, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-[var(--color-text-muted)] flex-shrink-0 select-none">
              {line.ts}
            </span>
            <span className={LOG_COLORS[line.type] ?? 'text-white'}>{line.text}</span>
          </div>
        ))}
        <div className="flex gap-3 mt-1">
          <span className="text-[var(--color-text-muted)] flex-shrink-0 select-none">
            02:14:31.500
          </span>
          <span className="text-[var(--color-text-muted)] terminal-cursor">█</span>
        </div>
      </div>
    </div>
  );
}

// ── Failover Comparison ────────────────────────────────────────────────────────

function FailoverComparison() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Without router */}
      <div className="glass-card p-6 border border-red-500/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 text-sm">✗</div>
            <span className="text-sm font-bold text-red-400">Without Router</span>
          </div>
          <div className="font-mono text-xs space-y-1.5">
            <div className="text-[var(--color-text-muted)]">10:42:01 → POST /v1/chat/completions</div>
            <div className="text-[var(--color-text-muted)]">10:42:01 → Target: OpenAI API</div>
            <div className="text-yellow-400">10:42:03 → 429 Too Many Requests</div>
            <div className="text-red-400 font-bold">10:42:03 → Error surfaced to user ✗</div>
            <div className="text-red-400">10:42:03 → App shows error screen</div>
          </div>
          <div className="mt-4 pt-4 border-t border-red-500/20">
            <p className="text-xs text-[var(--color-text-muted)]">Result: <span className="text-red-400 font-semibold">User sees an error. Conversation lost.</span></p>
          </div>
        </div>
      </div>

      {/* With router */}
      <div className="glass-card p-6 border border-green-500/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400 text-sm">✓</div>
            <span className="text-sm font-bold text-green-400">With AI API Platform</span>
          </div>
          <div className="font-mono text-xs space-y-1.5">
            <div className="text-[var(--color-text-muted)]">10:42:01 → POST /v1/chat/completions</div>
            <div className="text-[var(--color-text-muted)]">10:42:01 → Primary: OpenAI API</div>
            <div className="text-yellow-400">10:42:03 → 429 detected — auto-failover</div>
            <div className="text-blue-400">10:42:03 → Retry: {MODELS.ANTHROPIC_SONNET} (Anthropic)</div>
            <div className="text-green-400 font-bold">10:42:03 → 200 OK (+53ms overhead) ✓</div>
          </div>
          <div className="mt-4 pt-4 border-t border-green-500/20">
            <p className="text-xs text-[var(--color-text-muted)]">Result: <span className="text-green-400 font-semibold">Zero errors. 53ms added latency. User never noticed.</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Trust strip ────────────────────────────────────────────────────────────────

const PROVIDERS_STRIP = [
  { name: 'OpenAI',      color: '#10a37f' },
  { name: 'Anthropic',   color: '#d4a96a' },
  { name: 'Google',      color: '#4285f4' },
  { name: 'DeepSeek',    color: '#6366f1' },
  { name: 'xAI',         color: '#ff6b35' },
  { name: 'Meta',        color: '#0668e1' },
  { name: 'Mistral',     color: '#ff7000' },
  { name: 'Moonshot AI', color: '#a855f7' },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <Header />

      {/* ── Hero ── */}
      <section className="relative pt-28 pb-20 overflow-hidden">
        {/* Background glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] opacity-[0.12] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)', filter: 'blur(120px)' }}
        />

        <div className="max-w-5xl mx-auto px-6 text-center relative z-10 animate-fade-in">
          {/* Live badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] text-xs font-semibold uppercase tracking-wider mb-8 border border-[rgba(99,102,241,0.2)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-accent)]" />
            </span>
            Now live: {MODELS.OPENAI_FLAGSHIP} · {MODELS.ANTHROPIC_OPUS} · {MODELS.GOOGLE_PRO}
          </div>

          {/* H1 */}
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.08]">
            Smart AI Routing.{' '}
            <br className="hidden md:block" />
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #6366f1, #3b82f6)' }}
            >
              Every Frontier Model.
            </span>
          </h1>

          <p className="text-xl text-[var(--color-text-secondary)] mb-12 max-w-3xl mx-auto leading-relaxed">
            One OpenAI-compatible endpoint. Automatic failover, cost-optimized routing, and real-time model health — at prices significantly below direct lab pricing.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/signup"
              className="btn-primary text-base px-8 py-4 w-full sm:w-auto shadow-lg shadow-indigo-500/20"
            >
              Start Building for Free
            </Link>
            <Link href="/models" className="btn-secondary text-base px-8 py-4 w-full sm:w-auto">
              Explore Models →
            </Link>
          </div>

          {/* Animated routing diagram */}
          <RoutingFlow />
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="py-12 border-y border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Models Available',    value: '100+',  sub: 'frontier & open weights' },
              { label: 'Avg Cost Savings',    value: '~40%',  sub: 'vs direct lab pricing' },
              { label: 'Uptime SLA',          value: '99.9%', sub: 'with automatic failover' },
              { label: 'Providers Monitored', value: '20+',   sub: 'real-time health checks' },
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

      {/* ── Provider trust strip ── */}
      <section className="py-8 border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-6">
            Direct access to all major AI providers
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {PROVIDERS_STRIP.map((p) => (
              <div
                key={p.name}
                className="provider-chip"
                style={{ borderColor: p.color + '44', color: p.color }}
              >
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                {p.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Intelligence Leaderboard ── */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2">
                Intelligence Rankings · Live Data
              </p>
              <h2 className="text-3xl font-bold">Powered by Independent Benchmarks</h2>
              <p className="text-[var(--color-text-secondary)] mt-2 max-w-xl">
                We integrate live benchmark data from{' '}
                <a
                  href="https://artificialanalysis.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:underline"
                >
                  Artificial Analysis
                </a>{' '}
                so you always know which model leads — and we provide access to every single one.
              </p>
            </div>
            <Link
              href="/models"
              className="btn-primary py-2.5 px-6 text-sm whitespace-nowrap flex-shrink-0"
            >
              Explore All Models →
            </Link>
          </div>

          <Suspense fallback={<LeaderboardSkeleton />}>
            <LiveLeaderboard />
          </Suspense>

          <p className="text-xs text-[var(--color-text-muted)] text-center">
            Artificial Analysis Intelligence Index · Updated hourly ·{' '}
            <a
              href="https://artificialanalysis.ai/leaderboards/models"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              View full leaderboard ↗
            </a>
          </p>
        </div>
      </section>

      {/* ── Routing Decision Log ── */}
      <section className="py-20 bg-[var(--color-bg-secondary)] border-y border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-green-400 mb-3">
              Routing Intelligence
            </p>
            <h2 className="text-3xl font-bold mb-5">Every Decision, Explained</h2>
            <p className="text-[var(--color-text-secondary)] text-lg mb-8 leading-relaxed">
              The router evaluates latency, cost, and model health on every single request — in under 2ms. Every routing decision is logged, traceable, and auditable.
            </p>
            <ul className="space-y-4">
              {[
                { icon: '⚡', text: 'Sub-2ms routing decision per request' },
                { icon: '🔍', text: 'Full trace logs available via API' },
                { icon: '💰', text: 'Cost threshold enforcement per request' },
                { icon: '🔄', text: 'Automatic failover with zero client errors' },
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-[var(--color-text-primary)] font-medium">
                  <span className="text-lg">{item.icon}</span>
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
          <RoutingDecisionLog />
        </div>
      </section>

      {/* ── Failover Transparency ── */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-yellow-400 mb-3">
              Failover Transparency
            </p>
            <h2 className="text-3xl font-bold mb-4">Zero Downtime. Automatic.</h2>
            <p className="text-[var(--color-text-secondary)] text-lg max-w-2xl mx-auto">
              When a provider has an incident, your users never see an error. The router retries on the next healthy provider in milliseconds.
            </p>
          </div>
          <FailoverComparison />

          <div className="mt-8 flex items-center justify-center gap-8 text-sm text-[var(--color-text-muted)]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Average failover time: <strong className="text-white">53ms</strong>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              Failover chains configurable up to <strong className="text-white">5 deep</strong>
            </div>
          </div>
        </div>
      </section>

      {/* ── Code Demo ── */}
      <section className="py-20 bg-[var(--color-bg-secondary)] border-y border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div className="animate-slide-in">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">
              Drop-in Compatible
            </p>
            <h2 className="text-3xl font-bold mb-6">Works with Your Existing Code</h2>
            <p className="text-[var(--color-text-secondary)] text-lg mb-8 leading-relaxed">
              100% compatible with the OpenAI SDK. Swap your{' '}
              <code className="text-indigo-400 bg-indigo-400/10 px-1.5 rounded text-sm">baseURL</code>{' '}
              and instantly unlock {MODELS.ANTHROPIC_OPUS}, {MODELS.GOOGLE_PRO}, {MODELS.DEEPSEEK_V3}, and more — without changing a single line of application code.
            </p>
            <ul className="space-y-4">
              {[
                'Automatic failover when a provider goes down',
                'Cost-optimized routing across 20+ providers',
                'Real-time model availability and latency metrics',
                'Unified billing — one invoice for all models',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-[var(--color-text-primary)] font-medium">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-success)]/10 flex items-center justify-center text-[var(--color-success)] text-sm flex-shrink-0">
                    ✓
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Code block */}
          <div className="glass-card p-6 border-[var(--color-border)] relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--color-border)]">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-xs text-[var(--color-text-muted)] font-mono">app.js</span>
            </div>
            <pre className="text-sm font-mono text-[var(--color-text-primary)] overflow-x-auto leading-relaxed">
              <span className="text-purple-400">import</span> OpenAI <span className="text-purple-400">from</span> <span className="text-green-400">&apos;openai&apos;</span>;{'\n\n'}
              <span className="text-[var(--color-text-muted)]">{'// ① Just change baseURL + key'}</span>{'\n'}
              <span className="text-purple-400">const</span> client = <span className="text-purple-400">new</span> OpenAI({'({'}{'\n'}
              {'  '}apiKey: <span className="text-green-400">&apos;your_api_key&apos;</span>,{'\n'}
              {'  '}baseURL: <span className="text-green-400">&apos;https://aikompute.com/v1&apos;</span>{'\n'}
              {'}'}{')'}){'\n\n'}
              <span className="text-[var(--color-text-muted)]">{'// ② Access ANY frontier model'}</span>{'\n'}
              <span className="text-purple-400">const</span> res = <span className="text-purple-400">await</span> client.chat.completions.create({'({'}{'\n'}
              {'  '}model: <span className="text-green-400">{`'${MODELS.ANTHROPIC_SONNET_ID}'`}</span>,{'\n'}
              {'  '}messages: [{'{'} role: <span className="text-green-400">&apos;user&apos;</span>, content: <span className="text-green-400">&apos;Hello!&apos;</span> {'}'}]{'\n'}
              {'}'}{')'}
            </pre>
          </div>
        </div>
      </section>

      {/* ── Features grid ── */}
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
              {
                icon: '🔀',
                title: 'Cost-Optimized Routing',
                desc: 'Automatically routes to the lowest-cost provider that meets your latency threshold, saving up to 40% vs direct lab pricing.',
              },
              {
                icon: '🛡️',
                title: 'Automatic Failover',
                desc: 'If a provider returns an error or goes down, requests are instantly retried on a healthy alternative — zero downtime for your users.',
              },
              {
                icon: '📊',
                title: 'Real-Time Health Dashboard',
                desc: 'Monitor provider availability, P50/P99 latency, and error rates for every model from a live admin dashboard.',
              },
              {
                icon: '⚙️',
                title: 'Custom Routing Rules',
                desc: 'Pin specific users or request types to specific models. Define fallback chains that match your cost and quality requirements.',
              },
              {
                icon: '🔑',
                title: 'Virtual API Keys',
                desc: 'Issue per-user API keys with fine-grained rate limits, spending caps, and model allowlists — all managed from one dashboard.',
              },
              {
                icon: '📈',
                title: 'Usage Analytics',
                desc: 'Per-key and per-model usage tracking with token counts, costs, and latency breakdowns. Export to CSV or query via API.',
              },
            ].map((f, i) => (
              <div key={i} className="glass-card p-6 hover:-translate-y-0.5 transition-transform">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-white text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
          <p className="text-[var(--color-text-secondary)] text-lg mb-16 max-w-2xl mx-auto">
            Start free. Upgrade for higher limits and dedicated throughput.
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto text-left">
            {[
              {
                name: 'Free',
                price: '$0',
                desc: 'Perfect for prototyping',
                features: [
                  '50 requests/month total',
                  '5 req/min rate limit',
                  'Free-tier models only',
                  'Community support',
                ],
                featured: false,
              },
              {
                name: 'Basic',
                price: '$19',
                desc: 'For indie hackers',
                features: [
                  '1,000 requests/day',
                  '20 req/min rate limit',
                  `All models incl. ${MODELS.OPENAI_FLAGSHIP}`,
                  'Email support',
                ],
                featured: true,
              },
              {
                name: 'Pro',
                price: '$49',
                desc: 'For scaling startups',
                features: [
                  '10,000 requests/day',
                  '60 req/min rate limit',
                  'Priority routing',
                  'Dedicated support',
                ],
                featured: false,
              },
            ].map((plan, i) => (
              <div
                key={i}
                className={`glass-card p-8 relative flex flex-col ${
                  plan.featured ? 'ring-2 ring-[var(--color-accent)] md:-translate-y-4' : ''
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 badge-accent px-4 py-1">
                    Most Popular
                  </div>
                )}
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
                <Link
                  href="/signup"
                  className={plan.featured ? 'btn-primary w-full' : 'btn-secondary w-full'}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

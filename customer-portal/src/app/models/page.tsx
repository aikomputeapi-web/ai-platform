import Link from 'next/link';
import { Suspense } from 'react';
import { MODELS, MODEL_CATALOGUE } from '@/lib/models';
import {
  getLeaderboard,
  getModelMetrics,
  type LeaderboardEntry,
  type ModelMetric,
} from '@/lib/artificialanalysis';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SpeedChart, PriceChart, IntelligenceVsPriceChart, LeaderboardBar } from '@/components/ModelCharts';

// ISR — regenerate every hour so charts reflect the latest AA data
export const revalidate = 3600;

export const metadata = {
  title: 'AI Models — AI API Platform',
  description: `Access ${MODELS.OPENAI_FLAGSHIP}, ${MODELS.ANTHROPIC_OPUS}, ${MODELS.GOOGLE_PRO}, ${MODELS.DEEPSEEK_V3}, and dozens more frontier AI models through a single unified API — significantly cheaper than going to each lab directly.`,
};

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  frontier: { label: 'Frontier',     color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  standard: { label: 'Standard',     color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  fast:     { label: 'Speed',        color: 'text-green-400 bg-green-400/10 border-green-400/20' },
  open:     { label: 'Open Weights', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
};

// ── Async: Leaderboard section ─────────────────────────────────────────────────

async function LeaderboardSection() {
  const entries = await getLeaderboard();
  const top10 = entries.slice(0, 10);
  const maxScore = top10[0]?.intelligenceScore ?? 60;
  const updatedAt = new Date().toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <section className="py-16 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2">
              Artificial Analysis Intelligence Index · {updatedAt}
            </p>
            <h2 className="text-2xl font-bold">Intelligence Leaderboard</h2>
            <p className="text-[var(--color-text-secondary)] mt-1 text-sm max-w-xl">
              Independent benchmark measuring real-world reasoning across coding, science, math, and knowledge. Scores update automatically from{' '}
              <a
                href="https://artificialanalysis.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline"
              >
                Artificial Analysis
              </a>
              .
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

        <div className="glass-card p-6">
          <div className="space-y-3">
            {top10.map((m: LeaderboardEntry) => (
              <LeaderboardBar
                key={m.id}
                name={m.name}
                provider={m.provider}
                score={m.intelligenceScore}
                maxScore={maxScore}
                color={m.color}
                rank={m.rank}
                available={m.available}
              />
            ))}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-5 pt-4 border-t border-[var(--color-border)]">
            Source:{' '}
            <a
              href="https://artificialanalysis.ai/leaderboards/models"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              Artificial Analysis Intelligence Index
            </a>{' '}
            — scores reflect independent evaluation across GDPval-AA, GPQA Diamond, HLE, SciCode, and more. Updated hourly via ISR.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Async: Speed + Price charts ────────────────────────────────────────────────

async function SpeedPriceSection() {
  const metrics = await getModelMetrics();

  return (
    <section className="py-16 border-b border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-green-400 mb-2">
              Output Speed & Cost · Tokens per Second vs $/1M
            </p>
            <h2 className="text-2xl font-bold">Speed & Price Comparison</h2>
            <p className="text-[var(--color-text-secondary)] mt-1 text-sm">
              Median P50 measurements. All models below are available through our API.
            </p>
          </div>
          <a
            href="https://artificialanalysis.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary py-2 px-4 text-sm whitespace-nowrap flex-shrink-0"
          >
            Full Data ↗
          </a>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-5">
              Output Speed (tokens/sec) · Higher is faster
            </h3>
            <SpeedChart data={metrics} />
          </div>

          <div className="glass-card p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-5">
              Blended Price ($/1M tokens) · Lower is cheaper
            </h3>
            <PriceChart data={metrics} />
          </div>
        </div>

        <p className="text-xs text-[var(--color-text-muted)] text-center mt-4">
          Data sourced from{' '}
          <a
            href="https://artificialanalysis.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
          >
            Artificial Analysis
          </a>{' '}
          — median P50 measurements. Updated hourly.
        </p>
      </div>
    </section>
  );
}

// ── Async: Scatter plot ────────────────────────────────────────────────────────

async function ScatterSection() {
  const metrics = await getModelMetrics();

  return (
    <section className="py-16 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-2">
              Intelligence vs Cost · The Value Map
            </p>
            <h2 className="text-2xl font-bold">Find Your Optimal Model</h2>
            <p className="text-[var(--color-text-secondary)] mt-1 text-sm max-w-xl">
              Higher = smarter. Further left = cheaper. Models in the top-left are the best value. All of them are accessible through a single API.
            </p>
          </div>
          <a
            href="https://artificialanalysis.ai/leaderboards/models"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary py-2 px-4 text-sm whitespace-nowrap flex-shrink-0"
          >
            Detailed Analysis ↗
          </a>
        </div>

        <div className="glass-card p-6">
          <IntelligenceVsPriceChart data={metrics} />
          <p className="text-xs text-[var(--color-text-muted)] mt-4 text-center">
            Source:{' '}
            <a
              href="https://artificialanalysis.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              Artificial Analysis
            </a>{' '}
            · Dashed lines mark the &quot;value zone&quot;: high intelligence at budget prices.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Generic loading skeleton ───────────────────────────────────────────────────

function SectionSkeleton({ height = 'h-80' }: { height?: string }) {
  return (
    <section className="py-16 border-b border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-8 space-y-2">
          <div className="h-3 w-32 bg-[var(--color-border)] rounded animate-pulse" />
          <div className="h-6 w-64 bg-[var(--color-border)] rounded animate-pulse" />
          <div className="h-3 w-96 bg-[var(--color-border)] rounded animate-pulse" />
        </div>
        <div className={`glass-card ${height} animate-pulse`} />
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ModelsPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <Header activeTab="models" />

      <main>
        {/* Hero */}
        <section className="relative pt-24 pb-16 overflow-hidden border-b border-[var(--color-border)]">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] opacity-[0.12] pointer-events-none"
            style={{ background: 'radial-gradient(ellipse, #6366f1 0%, transparent 70%)', filter: 'blur(80px)' }}
          />
          <div className="max-w-5xl mx-auto px-6 text-center relative z-10 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] text-xs font-semibold uppercase tracking-wider mb-6 border border-[rgba(99,102,241,0.2)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-accent)]" />
              </span>
              Powered by Artificial Analysis · Updated hourly
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
              Every Frontier Model.{' '}
              <span
                className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #6366f1, #3b82f6)' }}
              >
                One API.
              </span>
            </h1>
            <p className="text-xl text-[var(--color-text-secondary)] max-w-3xl mx-auto leading-relaxed mb-8">
              Access {MODELS.OPENAI_FLAGSHIP}, {MODELS.ANTHROPIC_OPUS}, {MODELS.GOOGLE_PRO},{' '}
              {MODELS.DEEPSEEK_V3}, and dozens more — through a single unified endpoint, at prices
              significantly below direct lab pricing.
            </p>
            <div className="flex items-center justify-center gap-3 text-sm text-[var(--color-text-muted)]">
              <span>Benchmark data sourced from</span>
              <a
                href="https://artificialanalysis.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                artificialanalysis.ai ↗
              </a>
              <span>— updated live via ISR</span>
            </div>
          </div>
        </section>

        {/* Intelligence Leaderboard — dynamic */}
        <Suspense fallback={<SectionSkeleton height="h-96" />}>
          <LeaderboardSection />
        </Suspense>

        {/* Speed + Price — dynamic */}
        <Suspense fallback={<SectionSkeleton height="h-80" />}>
          <SpeedPriceSection />
        </Suspense>

        {/* Scatter plot — dynamic */}
        <Suspense fallback={<SectionSkeleton height="h-80" />}>
          <ScatterSection />
        </Suspense>

        {/* Model Cards Grid — from centralized MODEL_CATALOGUE */}
        <section className="py-16 border-b border-[var(--color-border)]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-10">
              <h2 className="text-2xl font-bold mb-2">Available Models</h2>
              <p className="text-[var(--color-text-secondary)]">
                All accessible via a single OpenAI-compatible endpoint. Use any model with the same SDK.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {MODEL_CATALOGUE.map((m) => {
                const tier = TIER_LABELS[m.tier];
                return (
                  <div
                    key={m.key}
                    className="glass-card p-6 flex flex-col gap-4 group hover:scale-[1.01] transition-transform"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                          {m.provider}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {tier && (
                          <span className={`badge border text-[10px] ${tier.color}`}>{tier.label}</span>
                        )}
                        <span className="badge-accent text-[10px]">{m.badge}</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg leading-snug">{m.name}</h3>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-1.5 leading-relaxed">
                        {m.blurb}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-[var(--color-border)]">
                      <code className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded font-mono">
                        {m.id}
                      </code>
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

        {/* Why cheaper */}
        <section className="py-16 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
          <div className="max-w-5xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-4">Why Cheaper Than the Labs?</h2>
            <p className="text-[var(--color-text-secondary)] text-lg mb-12 max-w-2xl mx-auto">
              We aggregate capacity across multiple providers and routes, passing the savings directly to you.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: '🔄',
                  title: 'Smart Routing',
                  desc: 'Requests are automatically routed to the cheapest available provider that meets your latency requirements.',
                },
                {
                  icon: '📦',
                  title: 'Volume Purchasing',
                  desc: "We pre-purchase token capacity in volume, securing rates that individual developers can't access directly.",
                },
                {
                  icon: '⚖️',
                  title: 'Load Balancing',
                  desc: 'Unused capacity is redistributed in real-time, maximizing utilization and reducing per-token costs.',
                },
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

      <Footer />
    </div>
  );
}

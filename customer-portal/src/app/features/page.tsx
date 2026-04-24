import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { MODELS } from '@/lib/models';

// ── Provider Health Grid ───────────────────────────────────────────────────────

const PROVIDER_HEALTH = [
  { name: 'OpenAI',      status: 'operational', latency: '1.2s', uptime: '99.9%', color: '#10a37f' },
  { name: 'Anthropic',   status: 'operational', latency: '0.9s', uptime: '99.8%', color: '#d4a96a' },
  { name: 'Google',      status: 'operational', latency: '0.4s', uptime: '99.9%', color: '#4285f4' },
  { name: 'DeepSeek',    status: 'degraded',    latency: '1.9s', uptime: '97.2%', color: '#6366f1' },
  { name: 'xAI',         status: 'operational', latency: '0.6s', uptime: '99.7%', color: '#ff6b35' },
  { name: 'Meta',        status: 'operational', latency: '0.5s', uptime: '99.6%', color: '#0668e1' },
  { name: 'Mistral',     status: 'operational', latency: '0.8s', uptime: '99.5%', color: '#ff7000' },
  { name: 'Moonshot AI', status: 'operational', latency: '0.7s', uptime: '99.4%', color: '#a855f7' },
];

const STATUS_CONFIG = {
  operational: { label: 'Operational', dotClass: 'bg-green-400', textClass: 'text-green-400', ping: true },
  degraded:    { label: 'Degraded',    dotClass: 'bg-yellow-400', textClass: 'text-yellow-400', ping: false },
  down:        { label: 'Down',        dotClass: 'bg-red-400', textClass: 'text-red-400', ping: false },
};

// ── Routing Rules Configurator ─────────────────────────────────────────────────

const ROUTING_RULES = [
  {
    condition: 'latency_budget < 500ms',
    action: `Route to ${MODELS.GOOGLE_FLASH}`,
    reason: 'Fastest model for real-time use',
    color: '#4285f4',
  },
  {
    condition: 'task_type = "code"',
    action: `Prefer ${MODELS.ANTHROPIC_SONNET}`,
    reason: 'Best coding benchmark score',
    color: '#d4a96a',
  },
  {
    condition: 'cost_per_request > $0.01',
    action: `Fallback to ${MODELS.DEEPSEEK_V3}`,
    reason: 'Cost ceiling enforcement',
    color: '#6366f1',
  },
  {
    condition: 'user_tier = "enterprise"',
    action: `Pin to ${MODELS.OPENAI_FLAGSHIP}`,
    reason: 'Highest quality guaranteed',
    color: '#10a37f',
  },
];

// ── Failover Chain ─────────────────────────────────────────────────────────────

const FAILOVER_CHAIN = [
  { model: MODELS.OPENAI_FLAGSHIP,   provider: 'OpenAI',    status: 'down',        color: '#10a37f' },
  { model: MODELS.ANTHROPIC_OPUS,    provider: 'Anthropic', status: 'operational', color: '#d4a96a' },
  { model: MODELS.GOOGLE_PRO,        provider: 'Google',    status: 'standby',     color: '#4285f4' },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] overflow-x-hidden">
      <Header activeTab="features" />

      {/* ── Hero ── */}
      <section className="relative pt-24 pb-16">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-[0.08] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)', filter: 'blur(100px)' }}
        />
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6">
            Intelligent Infrastructure for{' '}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
            >
              AI Builders
            </span>
          </h1>
          <p className="text-xl text-[var(--color-text-secondary)] mb-12 max-w-3xl mx-auto leading-relaxed">
            Everything you need to deploy, scale, and manage LLMs in production. We handle the operational complexity so you can focus on building.
          </p>
        </div>
      </section>

      {/* ── Live Health Grid ── */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
              Real-Time Provider Status
            </p>
            <h2 className="text-2xl font-bold">Live Health Dashboard</h2>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            7/8 Operational
          </span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PROVIDER_HEALTH.map((p) => {
            const s = STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG];
            return (
              <div key={p.name} className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="font-bold text-white text-sm">{p.name}</span>
                  </div>
                  <div className="relative">
                    <div className={`w-2 h-2 rounded-full ${s.dotClass}`} />
                    {s.ping && (
                      <div className={`absolute inset-0 w-2 h-2 rounded-full ${s.dotClass} animate-ping opacity-50`} />
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">P50 latency</span>
                    <span className="text-white font-mono">{p.latency}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">30d uptime</span>
                    <span className="font-semibold font-mono" style={{ color: p.uptime >= '99%' ? '#10b981' : '#f59e0b' }}>
                      {p.uptime}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">Status</span>
                    <span className={`font-semibold ${s.textClass}`}>{s.label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Routing Rules Configurator ── */}
      <section className="py-20 bg-[var(--color-bg-secondary)] border-y border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">
              Custom Routing Logic
            </p>
            <h2 className="text-3xl font-bold mb-5">Define Your Routing Rules</h2>
            <p className="text-[var(--color-text-secondary)] text-lg mb-8 leading-relaxed">
              Fine-grained routing rules let you control exactly where each request goes — by latency, cost, task type, user tier, or any custom signal from your application.
            </p>
            <ul className="space-y-4">
              {[
                'Rule-based routing by latency, cost, or task type',
                'Pin specific users or tenants to specific models',
                'Cost ceilings enforced per request or per user',
                'Fallback chains up to 5 deep — never fail silently',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-[var(--color-text-primary)]">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs mt-0.5 flex-shrink-0">
                    ✓
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Routing Rules UI mockup */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-[var(--color-border)]">
              <span className="text-sm font-bold text-white">Routing Rules</span>
              <span className="text-xs text-[var(--color-text-muted)] font-mono">{ROUTING_RULES.length} active rules</span>
            </div>
            <div className="space-y-3 mb-4">
              {ROUTING_RULES.map((rule, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] hover:border-[var(--color-border-focus)] transition-colors group"
                >
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold text-white"
                    style={{ backgroundColor: rule.color + '44', color: rule.color }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs text-[var(--color-text-muted)] mb-1">
                      IF <span className="text-yellow-400">{rule.condition}</span>
                    </div>
                    <div className="font-mono text-xs text-white mb-1">
                      → <span style={{ color: rule.color }}>{rule.action}</span>
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">{rule.reason}</div>
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-white text-xs px-2">
                    ✎
                  </button>
                </div>
              ))}
            </div>
            <button className="w-full py-2.5 text-sm text-[var(--color-text-muted)] hover:text-white border border-dashed border-[var(--color-border)] hover:border-[var(--color-border-focus)] rounded-lg transition-colors flex items-center justify-center gap-2">
              <span className="text-lg leading-none">+</span>
              Add Rule
            </button>
          </div>
        </div>
      </section>

      {/* ── Failover Chain Visualizer ── */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-yellow-400 mb-3">
              Automatic Failover
            </p>
            <h2 className="text-3xl font-bold mb-4">Never Fail Your Users</h2>
            <p className="text-[var(--color-text-secondary)] text-lg max-w-2xl mx-auto">
              When the primary provider is unavailable, the router silently retries the next healthy option in your defined fallback chain.
            </p>
          </div>

          {/* Failover chain */}
          <div className="glass-card p-8 max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                Failover Sequence — Active Incident
              </span>
            </div>

            <div className="space-y-4">
              {FAILOVER_CHAIN.map((node, i) => {
                const isDown = node.status === 'down';
                const isActive = node.status === 'operational';
                const isStandby = node.status === 'standby';

                return (
                  <div key={i}>
                    <div
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        isDown
                          ? 'border-red-500/40 bg-red-500/5'
                          : isActive
                          ? 'border-green-500/40 bg-green-500/5'
                          : 'border-[var(--color-border)] opacity-50'
                      }`}
                    >
                      {/* Step number */}
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          isDown
                            ? 'bg-red-500/20 text-red-400'
                            : isActive
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-[var(--color-border)] text-[var(--color-text-muted)]'
                        }`}
                      >
                        {i + 1}
                      </div>

                      {/* Provider info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: node.color }} />
                          <span className="font-bold text-white text-sm">{node.provider}</span>
                          <span className="text-[var(--color-text-muted)] text-xs">·</span>
                          <span className="text-xs text-[var(--color-text-muted)]">{node.model}</span>
                        </div>
                      </div>

                      {/* Status badge */}
                      {isDown && (
                        <span className="text-xs font-bold text-red-400 bg-red-400/10 px-2.5 py-1 rounded-full border border-red-400/20">
                          ✗ Down
                        </span>
                      )}
                      {isActive && (
                        <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full border border-green-400/20">
                          ✓ Serving
                        </span>
                      )}
                      {isStandby && (
                        <span className="text-xs font-bold text-[var(--color-text-muted)] bg-[var(--color-border)] px-2.5 py-1 rounded-full">
                          Standby
                        </span>
                      )}
                    </div>

                    {/* Arrow between steps */}
                    {i < FAILOVER_CHAIN.length - 1 && (
                      <div className="flex items-center gap-4 pl-6 py-1">
                        <div className="w-px h-4 bg-[var(--color-border)] ml-3" />
                        {isDown && (
                          <span className="text-[10px] text-yellow-400 font-mono ml-4">
                            ↳ failover triggered (+53ms)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
              <span>Total added latency: <strong className="text-white">53ms</strong></span>
              <span>Errors surfaced to client: <strong className="text-green-400">0</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Grid ── */}
      <section className="max-w-7xl mx-auto px-6 py-20 border-t border-[var(--color-border)]">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Everything You Need in Production</h2>
          <p className="text-[var(--color-text-secondary)] text-lg max-w-2xl mx-auto">
            Built for engineering teams who need reliability, observability, and control.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              color: 'text-indigo-400',
              bg: 'bg-[var(--color-accent-subtle)]',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              ),
              title: 'Unified API',
              desc: 'One endpoint for all models. Seamlessly swap between OpenAI, Anthropic, Gemini, and Llama without modifying your codebase.',
            },
            {
              color: 'text-green-400',
              bg: 'bg-green-500/10',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              ),
              title: 'Consolidated Billing',
              desc: 'Stop tracking multiple vendor invoices. Pay one unified bill for all your AI usage across every provider — with per-model breakdowns.',
            },
            {
              color: 'text-red-400',
              bg: 'bg-red-500/10',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              ),
              title: 'Smart Failover',
              desc: 'Automatic retry on healthy alternatives when your primary provider experiences downtime or rate limits. Zero client errors.',
            },
            {
              color: 'text-yellow-400',
              bg: 'bg-yellow-500/10',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              ),
              title: 'Advanced Analytics',
              desc: 'Monitor latency, token usage, and cost per request with beautiful built-in dashboards. Export via CSV or query via REST API.',
            },
            {
              color: 'text-pink-400',
              bg: 'bg-pink-500/10',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                  <rect x="9" y="9" width="6" height="6" />
                </svg>
              ),
              title: 'Virtual API Keys',
              desc: 'Issue per-user API keys with spending caps, rate limits, and model allowlists. Revoke any key instantly without affecting other users.',
            },
            {
              color: 'text-purple-400',
              bg: 'bg-purple-500/10',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
              ),
              title: 'OpenAI SDK Native',
              desc: 'No new SDK to learn. We natively support the OpenAI Chat Completions API format — swap your baseURL and go.',
            },
          ].map((f, i) => (
            <div key={i} className="glass-card p-8 group hover:-translate-y-1 transition-transform">
              <div className={`w-12 h-12 rounded-lg ${f.bg} flex items-center justify-center mb-6 ${f.color}`}>
                {f.icon}
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">{f.title}</h3>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to deploy with confidence?</h2>
          <p className="text-[var(--color-text-secondary)] text-lg mb-8">
            Get your API key in 60 seconds. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="btn-primary text-base px-8 py-3 w-full sm:w-auto shadow-lg shadow-indigo-500/20">
              Start for Free
            </Link>
            <Link href="/models" className="btn-secondary text-base px-8 py-3 w-full sm:w-auto">
              Browse Models →
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

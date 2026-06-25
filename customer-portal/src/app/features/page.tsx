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
    <div className="min-h-screen bg-black font-mono flex flex-col">
      <nav className="flex items-center justify-between max-w-3xl mx-auto w-full px-6 py-5 text-xs">
        <Link href="/" className="text-white">◇ aikompute</Link>
        <div className="flex items-center gap-5" style={{ color: 'var(--color-grey)' }}>
          <Link href="/models" className="hover:text-white">Models</Link>
          <span className="text-white">Features</span>
          <Link href="/docs" className="hover:text-white">Docs</Link>
          <Link href="/login" className="hover:text-white">Sign in</Link>
          <Link href="/signup" className="btn-outline">Register</Link>
        </div>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pb-20">
        <section className="py-14">
          <h1 className="text-4xl font-light tracking-tight text-white">Features</h1>
        </section>

        {/* Provider health */}
        <section className="pb-14">
          <div className="text-xs uppercase tracking-wider pb-4" style={{ color: 'var(--color-grey-dim)', borderBottom: '1px solid var(--color-border)' }}>Provider Health</div>
          <div className="grid sm:grid-cols-4 gap-px mt-4" style={{ background: 'var(--color-border)' }}>
            {PROVIDERS.map((p) => (
              <div key={p.name} className="card p-4" style={{ background: '#000' }}>
                <div className="text-sm text-white">{p.name}</div>
                <div className="mt-3 text-xs flex justify-between" style={{ color: 'var(--color-grey)' }}>
                  <span>latency</span>
                  <span className="text-white">{p.latency}</span>
                </div>
                <div className="text-xs flex justify-between" style={{ color: 'var(--color-grey)' }}>
                  <span>uptime</span>
                  <span className="text-white">{p.uptime}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Routing rules */}
        <section className="pb-14">
          <div className="text-xs uppercase tracking-wider pb-4" style={{ color: 'var(--color-grey-dim)', borderBottom: '1px solid var(--color-border)' }}>Routing Rules</div>
          <div className="mt-4 space-y-2">
            {RULES.map((r, i) => (
              <div key={i} className="card p-4 text-xs" style={{ background: '#000' }}>
                <div style={{ color: 'var(--color-grey)' }}>IF <span className="text-white">{r.if}</span></div>
                <div className="mt-1">THEN <span className="text-white">{r.then}</span></div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="max-w-3xl mx-auto w-full px-6 py-6 border-t text-[10px]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-grey-dim)' }}>
        <div className="flex justify-between">
          <span>© 2026</span>
          <div className="flex gap-5">
            <Link href="/docs" className="hover:text-white">Docs</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
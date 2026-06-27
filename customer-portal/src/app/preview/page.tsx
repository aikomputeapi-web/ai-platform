import Link from 'next/link';

export default function MinimalistPreview() {
  return (
    <main className="min-h-screen bg-black text-[var(--color-text-secondary)]">
      {/* Nav */}
      <nav className="max-w-4xl mx-auto px-6 py-8 flex items-center justify-between">
        <span className="text-xs font-display font-semibold tracking-[0.2em] text-white/60 uppercase">
          ◇ AETHER
        </span>
        <Link
          href="/signup"
          className="text-[10px] font-display tracking-[0.18em] uppercase text-white/40 hover:text-white"
        >
          Sign in →
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-32 pb-24">
        <h1 className="font-display text-5xl sm:text-6xl font-light tracking-tight leading-[1.05] text-white/90">
          One gateway.
          <br />
          <span className="text-white/30">Every model.</span>
        </h1>
        <p className="mt-8 max-w-md text-sm leading-relaxed text-white/40">
           We provide all Anthropic and OpenAI models, plus all the top open source models are included. Failover, routing, and latency checks included.
        </p>
        <div className="mt-10 flex items-center gap-6">
          <Link
            href="/signup"
            className="text-[11px] font-display tracking-[0.18em] uppercase text-black bg-white px-5 py-3 hover:bg-white/80"
          >
            Get Access
          </Link>
          <Link
            href="/models"
            className="text-[11px] font-display tracking-[0.18em] uppercase text-white/40 hover:text-white"
          >
            Models
          </Link>
        </div>
      </section>

      {/* Stats line */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-t border-white/5">
        <div className="grid grid-cols-3 gap-8 font-mono">
          <div>
            <div className="text-3xl font-light text-white/80">100+</div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-white/30">Models</div>
          </div>
          <div>
            <div className="text-3xl font-light text-white/80">99.9%</div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-white/30">Uptime</div>
          </div>
          <div>
            <div className="text-3xl font-light text-white/80">&lt;40ms</div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-white/30">Overhead</div>
          </div>
        </div>
      </section>

      {/* How */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {[
            ['01', 'Connect', 'Swap your baseURL. No new SDKs.'],
            ['02', 'Route', 'Policies, fallbacks, and weightings per model.'],
            ['03', 'Ship', 'One bill. One quota. Zero surprises.'],
          ].map(([n, t, d]) => (
            <div key={n}>
              <div className="font-mono text-[10px] text-white/20 tracking-[0.18em]">{n}</div>
              <h3 className="mt-4 font-display text-base font-semibold text-white/80">{t}</h3>
              <p className="mt-2 text-xs leading-relaxed text-white/40">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-4xl mx-auto px-6 py-24 border-t border-white/5">
        <h2 className="font-display text-2xl font-light text-white/80">Pricing</h2>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5">
          {[
            ['Pro', '$15', ['High capacity usage', 'Sonnet & Llama', 'Standard routing']],
            ['Max 5x', '$75', ['5x Pro capacity', 'All flagship models', 'High priority']],
            ['Max 20x', '$150', ['20x Pro capacity', 'All flagship models', 'Highest priority']],
          ].map(([name, price, feats]: any) => (
            <div key={name} className="bg-black p-8">
              <div className="font-display text-xs uppercase tracking-[0.18em] text-white/40">{name}</div>
              <div className="mt-4 font-display text-3xl font-light text-white/90">{price}<span className="text-xs text-white/30">/mo</span></div>
              <ul className="mt-6 space-y-2">
                {feats.map((f: string) => (
                  <li key={f} className="text-xs text-white/40 font-mono">— {f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-6 py-16 border-t border-white/5 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-white/30">
        <span>© 2026</span>
        <div className="flex gap-6">
          <Link href="/docs" className="hover:text-white/60">Docs</Link>
          <Link href="/terms" className="hover:text-white/60">Terms</Link>
          <Link href="/privacy" className="hover:text-white/60">Privacy</Link>
        </div>
      </footer>
    </main>
  );
}
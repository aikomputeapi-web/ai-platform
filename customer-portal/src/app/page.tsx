import Link from 'next/link';

export default function Home() {
  return (
    <div
      className="min-h-screen bg-black text-white font-mono flex flex-col"
      style={{ background: '#000' }}
    >
      {/* Nav */}
      <nav
        className="flex items-center justify-between max-w-3xl mx-auto w-full px-6 py-5"
        style={{ fontSize: '12px' }}
      >
        <span className="text-white">◇ aikompute</span>
        <div
          className="flex items-center gap-5"
          style={{ color: 'var(--color-grey)' }}
        >
          <Link href="/models" className="hover:text-white">Models</Link>
          <Link href="/docs" className="hover:text-white">Docs</Link>
          <Link href="/login" className="hover:text-white">Sign in</Link>
          <Link href="/signup" className="btn-outline">Register</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-light tracking-tight leading-tight text-white">
          One API.<br />
          <span style={{ color: 'var(--color-grey)' }}>100+ models.</span>
        </h1>
        <div className="mt-8 flex items-center gap-4">
          <Link href="/signup" className="btn">Register</Link>
          <Link href="/models" className="btn-outline">Models</Link>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-3xl mx-auto w-full px-6 pb-20">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--color-border)' }}>
          {[
            ['Pro', '$5'],
            ['Max 5x', '$20'],
            ['Max 20x', '$40'],
          ].map(([name, price]) => (
            <div key={name} className="p-6 text-center card" style={{ background: '#000' }}>
              <div className="text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--color-grey)' }}>{name}</div>
              <div className="mt-3 text-2xl text-white">{price}<span className="text-xs" style={{ color: 'var(--color-grey-dim)' }}>/mo</span></div>
              <Link href="/signup" className="btn-outline mt-5 inline-block" style={{ fontSize: '10px' }}>Select</Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        className="max-w-3xl mx-auto w-full px-6 py-6 border-t flex items-center justify-between"
        style={{ borderColor: 'var(--color-border)', fontSize: '10px', color: 'var(--color-grey-dim)' }}
      >
        <span>© 2026</span>
        <div className="flex gap-5">
          <Link href="/docs" className="hover:text-white">Docs</Link>
          <Link href="/terms" className="hover:text-white">Terms</Link>
          <Link href="/privacy" className="hover:text-white">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
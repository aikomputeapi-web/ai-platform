import Link from 'next/link';
import { Suspense } from 'react';
import { MODEL_CATALOGUE } from '@/lib/models';
import { getModelMetrics } from '@/lib/artificialanalysis';

export const revalidate = 3600;

export const metadata = {
  title: 'Models — aikompute',
};

async function MetricsTable() {
  const metrics = await getModelMetrics();

  return (
    <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr className="text-[10px] text-left uppercase tracking-wider" style={{ color: 'var(--color-grey-dim)', borderBottom: '1px solid var(--color-border)' }}>
          <th className="px-4 py-3 font-normal">Model</th>
          <th className="px-4 py-3 font-normal text-right">t/s</th>
          <th className="px-4 py-3 font-normal text-right">$/1M</th>
        </tr>
      </thead>
      <tbody>
        {metrics.map((m) => (
          <tr key={m.id} style={{ borderTop: '1px solid rgba(255,255,255,0.02)' }}>
            <td className="px-4 py-3 text-white">{m.name}</td>
            <td className="px-4 py-3 text-right" style={{ color: 'var(--color-grey)' }}>{m.outputSpeed ?? '—'}</td>
            <td className="px-4 py-3 text-right" style={{ color: 'var(--color-grey)' }}>${m.blendedPrice ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ModelsPage() {
  return (
    <div className="min-h-screen bg-black font-mono flex flex-col">
      <nav className="flex items-center justify-between max-w-3xl mx-auto w-full px-6 py-5 text-xs">
        <Link href="/" className="text-white">◇ aikompute</Link>
        <div className="flex items-center gap-5" style={{ color: 'var(--color-grey)' }}>
          <span className="text-white">Models</span>
          <Link href="/docs" className="hover:text-white">Docs</Link>
          <Link href="/login" className="hover:text-white">Sign in</Link>
          <Link href="/signup" className="btn-outline">Register</Link>
        </div>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6">
        <section className="py-14">
          <h1 className="text-4xl font-light tracking-tight text-white">Models</h1>
          <p className="mt-2 text-xs" style={{ color: 'var(--color-grey-dim)' }}>{MODEL_CATALOGUE.length} available</p>
        </section>

        <section className="pb-14">
          <div className="card">
            <Suspense fallback={<div className="p-8 text-xs text-grey">Loading...</div>}>
              <MetricsTable />
            </Suspense>
          </div>
        </section>

        {/* Model grid */}
        <section className="pb-20">
          <div className="grid sm:grid-cols-3 gap-px" style={{ background: 'var(--color-border)' }}>
            {MODEL_CATALOGUE.map((m) => (
              <div key={m.key} className="card p-5" style={{ background: '#000' }}>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-grey-dim)' }}>{m.provider}</div>
                <div className="mt-2 text-sm text-white">{m.name}</div>
                <code className="mt-3 block text-[10px]" style={{ color: 'var(--color-grey)' }}>{m.id}</code>
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
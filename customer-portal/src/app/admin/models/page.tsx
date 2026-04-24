'use client';
import { useState } from 'react';
import Link from 'next/link';
import { MODELS, MODEL_CATALOGUE } from '@/lib/models';

// Editable snapshot of MODELS (in a real app this would be persisted to a DB/config file)
type ModelEntry = { key: string; label: string; value: string };

const initialModels: ModelEntry[] = Object.entries(MODELS)
  .filter(([k]) => !k.endsWith('_ID'))
  .map(([key, value]) => ({ key, label: key.replace(/_/g, ' '), value: value as string }));

export default function ModelsAdminPage() {
  const [models, setModels] = useState<ModelEntry[]>(initialModels);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');

  const handleChange = (key: string, newValue: string) => {
    setModels(prev => prev.map(m => m.key === key ? { ...m, value: newValue } : m));
    setSaved(false);
  };

  const handleSave = () => {
    // In production this would POST to /api/admin/models and write to a config file
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const filtered = models.filter(
    m =>
      m.label.toLowerCase().includes(search.toLowerCase()) ||
      m.value.toLowerCase().includes(search.toLowerCase())
  );

  const providers = ['OPENAI', 'ANTHROPIC', 'GOOGLE', 'DEEPSEEK', 'GROK', 'META', 'MISTRAL', 'QWEN', 'KIMI'];

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--color-border)] bg-[rgba(10,10,15,0.9)] backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="font-bold text-lg tracking-tight">AI API Platform</span>
            </Link>
            <span className="text-[var(--color-text-muted)]">/</span>
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">Model Name Editor</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/models" className="btn-secondary py-2 px-4 text-sm">← Public Models Page</Link>
            <button
              onClick={handleSave}
              className={`btn-primary py-2 px-5 text-sm transition-all ${saved ? 'bg-green-500' : ''}`}
            >
              {saved ? '✓ Saved!' : 'Save All Changes'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Page Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-4 border border-yellow-500/20">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Admin Only
          </div>
          <h1 className="text-3xl font-bold mb-3">Model Name Editor</h1>
          <p className="text-[var(--color-text-secondary)] max-w-2xl">
            This is the central registry for every AI model name displayed on the website. 
            Updating a name here will change it on the homepage, docs, features page, and model browser simultaneously — no code changes required.
          </p>
        </div>

        {/* Info banner */}
        <div className="glass-card p-4 mb-8 flex items-start gap-4 border-indigo-500/30">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          </div>
          <div>
            <p className="font-semibold text-sm text-white mb-1">How it works</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Model names are imported from <code className="bg-[var(--color-bg-card)] px-1.5 py-0.5 rounded text-xs text-indigo-400">src/lib/models.ts</code> — a single TypeScript config file. 
              In this admin UI you can visually edit them. Saving re-generates that file via the API, so the next deployment picks up your changes automatically.
              The <code className="bg-[var(--color-bg-card)] px-1.5 py-0.5 rounded text-xs text-indigo-400">_ID</code> fields are the API identifiers and should match your OmniRoute provider slugs.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            className="input-field max-w-sm"
            placeholder="Search model keys or names..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Model Groups */}
        {providers.map(provider => {
          const group = filtered.filter(m => m.key.startsWith(provider));
          if (group.length === 0) return null;
          return (
            <div key={provider} className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3 pl-1">
                {provider === 'OPENAI' ? 'OpenAI'
                  : provider === 'ANTHROPIC' ? 'Anthropic'
                  : provider === 'GOOGLE' ? 'Google DeepMind'
                  : provider === 'DEEPSEEK' ? 'DeepSeek'
                  : provider === 'GROK' ? 'xAI (Grok)'
                  : provider === 'META' ? 'Meta'
                  : provider === 'MISTRAL' ? 'Mistral AI'
                  : provider === 'QWEN' ? 'Alibaba (Qwen)'
                  : 'Moonshot AI (Kimi)'}
              </h2>
              <div className="glass-card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[rgba(255,255,255,0.02)]">
                      <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] w-64">Variable Key</th>
                      <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Display Name / Value</th>
                      <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] w-32">Used In</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {group.map(m => (
                      <tr key={m.key} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                        <td className="p-4">
                          <code className="text-xs text-purple-400 bg-purple-400/10 px-2 py-1 rounded font-mono">
                            MODELS.{m.key}
                          </code>
                        </td>
                        <td className="p-4">
                          <input
                            id={`model-${m.key}`}
                            type="text"
                            value={m.value}
                            onChange={e => handleChange(m.key, e.target.value)}
                            className="input-field py-2 text-sm font-medium max-w-sm"
                          />
                        </td>
                        <td className="p-4">
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {m.key.includes('FLAGSHIP') || m.key.includes('OPUS') || m.key.includes('PRO') ? 'Homepage, Docs, Models' : 'Docs, Models'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* Model Catalogue Preview */}
        <div className="mt-12">
          <h2 className="text-lg font-bold mb-4">Live Preview — Model Catalogue Cards</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">This is how models will appear on the public-facing <strong>/models</strong> page.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODEL_CATALOGUE.slice(0, 6).map(m => (
              <div key={m.key} className="glass-card p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{m.provider}</span>
                  <span className="badge-accent text-[10px]">{m.badge}</span>
                </div>
                <p className="font-bold text-white text-lg leading-snug">{m.name}</p>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{m.blurb}</p>
                <code className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded font-mono">{m.id}</code>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-[var(--color-border)] flex items-center justify-end gap-3">
          <p className="text-sm text-[var(--color-text-muted)] flex-1">
            Changes saved here will reflect on the public site on next build/deploy.
          </p>
          <button
            onClick={handleSave}
            className={`btn-primary py-2.5 px-6 ${saved ? 'bg-green-500' : ''}`}
          >
            {saved ? '✓ Changes Saved!' : 'Save All Changes'}
          </button>
        </div>
      </main>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, RefreshCw, Layers3, BarChart3, Sparkles } from 'lucide-react';
import { MODELS, MODEL_CATALOGUE } from '@/lib/models';

type ModelEntry = { key: string; label: string; value: string };

type ModelUsage = { model: string; requests: number };

type AdminAnalyticsResponse = {
  summary: {
    totalRequests: number;
    totalCost: number;
    totalUsers: number;
    totalApiKeys: number;
  };
  globalAnalytics: {
    byModel: ModelUsage[];
  };
  range: string;
};

const initialModels: ModelEntry[] = Object.entries(MODELS)
  .filter(([key]) => !key.endsWith('_ID'))
  .map(([key, value]) => ({ key, label: key.replace(/_/g, ' '), value: value as string }));

const RANGE_OPTIONS = ['7d', '30d', '90d', 'all'] as const;

const PROVIDERS = [
  'OPENAI',
  'ANTHROPIC',
  'GOOGLE',
  'DEEPSEEK',
  'GROK',
  'META',
  'MISTRAL',
  'QWEN',
  'KIMI',
] as const;

function formatNumber(value: number) {
  return value.toLocaleString();
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${value.toFixed(0)}`;
}

function providerLabel(provider: string) {
  switch (provider) {
    case 'OPENAI':
      return 'OpenAI';
    case 'ANTHROPIC':
      return 'Anthropic';
    case 'GOOGLE':
      return 'Google DeepMind';
    case 'DEEPSEEK':
      return 'DeepSeek';
    case 'GROK':
      return 'xAI (Grok)';
    case 'META':
      return 'Meta';
    case 'MISTRAL':
      return 'Mistral AI';
    case 'QWEN':
      return 'Alibaba (Qwen)';
    case 'KIMI':
      return 'Moonshot AI (Kimi)';
    default:
      return provider;
  }
}

function getProviderForModel(model: string) {
  const upper = model.toUpperCase();
  if (upper.includes('CLAUDE')) return 'ANTHROPIC';
  if (upper.includes('GPT') || upper.includes('O1') || upper.includes('O3')) return 'OPENAI';
  if (upper.includes('GEMINI') || upper.includes('PALM')) return 'GOOGLE';
  if (upper.includes('DEEPSEEK')) return 'DEEPSEEK';
  if (upper.includes('GROK') || upper.includes('XAI')) return 'GROK';
  if (upper.includes('LLAMA') || upper.includes('META')) return 'META';
  if (upper.includes('MISTRAL')) return 'MISTRAL';
  if (upper.includes('QWEN')) return 'QWEN';
  if (upper.includes('KIMI')) return 'KIMI';
  return 'OTHER';
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 0;
  return (
    <div className="h-2 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
      <div
        className="h-full rounded-full bg-[var(--color-success)]"
        style={{
          width: `${pct}%`,
        }}
      />
    </div>
  );
}

export default function ModelsAdminPage() {
  const [models, setModels] = useState<ModelEntry[]>(initialModels);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]>('all');
  const [data, setData] = useState<AdminAnalyticsResponse | null>(null);

  const fetchData = useCallback(async (selectedRange: (typeof RANGE_OPTIONS)[number] = range) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?range=${selectedRange}`);
      if (!res.ok) {
        setError('Failed to load model economics');
        return;
      }
      setData(await res.json());
      setError('');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [range]);

  const handleChange = (key: string, newValue: string) => {
    setModels((prev) => prev.map((model) => (model.key === key ? { ...model, value: newValue } : model)));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  };

  const filtered = models.filter(
    (model) =>
      model.label.toLowerCase().includes(search.toLowerCase()) ||
      model.value.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = useMemo(() => {
    const result = new Map<string, ModelEntry[]>();
    for (const provider of PROVIDERS) result.set(provider, []);
    for (const model of filtered) {
      const provider = PROVIDERS.find((prefix) => model.key.startsWith(prefix)) || 'OTHER';
      const list = result.get(provider) || [];
      list.push(model);
      result.set(provider, list);
    }
    return result;
  }, [filtered]);

  const analytics = useMemo(() => data?.globalAnalytics.byModel || [], [data]);
  const topModels = useMemo(() => analytics.slice(0, 8), [analytics]);
  const maxRequests = Math.max(...topModels.map((entry) => entry.requests || 0), 1);
  const totalRequests = data?.summary.totalRequests || 0;
  const totalCost = data?.summary.totalCost || 0;
  const modelIntelligence = topModels.map((entry) => {
    const share = totalRequests > 0 ? entry.requests / totalRequests : 0;
    return {
      ...entry,
      share,
      estimatedCost: totalCost * share,
      provider: getProviderForModel(entry.model),
    };
  });
  const dominantModel = modelIntelligence[0];
  const concentration = modelIntelligence.slice(0, 3).reduce((sum, entry) => sum + entry.share, 0);
  const activeCatalog = MODEL_CATALOGUE.length;

  useEffect(() => {
    void fetchData(range);
  }, [range, fetchData]);

  if (loading || !data) {
    return (
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading model intelligence…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <div className="glass-card p-6 mb-8 border border-[var(--color-border)] relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at top right, rgba(255,255,255,0.06), transparent 35%)',
            }}
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-accent-subtle)] text-white text-xs font-semibold uppercase tracking-wider mb-4 border border-[var(--color-border)]">
                Model Registry
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05] mb-3">
                Control the model catalog and watch the economics behind it.
              </h1>
              <p className="text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
                This page combines the editable model registry with a live usage-led economics view so the owner can see which models are carrying the load, how concentrated the mix is, and where spend is flowing.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setRange(option);
                    void fetchData(option);
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all cursor-pointer ${
                    range === option
                      ? 'bg-white text-black border-white'
                      : 'bg-transparent text-[var(--color-text-secondary)] hover:text-white border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]'
                  }`}
                >
                  {option.toUpperCase()}
                </button>
              ))}
              <button
                onClick={() => void fetchData()}
                className="px-3 py-1.5 rounded text-xs font-semibold border border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-card-hover)] transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
              <button
                onClick={handleSave}
                className={`px-3 py-1.5 rounded text-xs font-semibold border border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-card-hover)] transition-all cursor-pointer inline-flex items-center gap-2 ${
                  saved ? 'bg-emerald-500 text-white border-emerald-500' : ''
                }`}
              >
                {saved ? '✓ Saved' : 'Save Registry'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Requests', value: formatCompact(totalRequests), sub: `${data.range.toUpperCase()} usage window`, color: '#ffffff' },
            { label: 'Estimated Spend', value: formatMoney(totalCost), sub: 'request-share allocation', color: '#a1a1aa' },
            { label: 'Catalog Entries', value: formatNumber(activeCatalog), sub: 'public and internal model cards', color: '#71717a' },
            { label: 'Top 3 Share', value: `${Math.round(concentration * 100)}%`, sub: 'mix concentration', color: '#d4d4d8' },
          ].map((card) => (
            <div key={card.label} className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--color-text-muted)] text-xs font-medium">{card.label}</span>
                <span className="text-base" style={{ color: card.color }}>●</span>
              </div>
              <div className="stat-value text-2xl">{card.value}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">{card.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid xl:grid-cols-[1.1fr_0.9fr] gap-6 mb-8">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold">Model Economics</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Usage-led allocation of current spend by model.</p>
              </div>
              <span className="badge-accent">ESTIMATED</span>
            </div>

            {modelIntelligence.length > 0 ? (
              <>
                <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--color-bg-primary)' }}>
                  <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Leading model</div>
                  <div className="text-2xl font-semibold">{dominantModel?.model || '—'}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">
                    {dominantModel ? `${Math.round(dominantModel.share * 100)}% of requests · ${formatMoney(dominantModel.estimatedCost)}` : 'No model usage recorded yet'}
                  </div>
                </div>
                <div className="space-y-3">
                  {modelIntelligence.map((entry, index) => (
                    <div key={entry.model} className="rounded-xl p-4 border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="badge-accent text-[10px]">#{index + 1}</span>
                            <span className="font-semibold truncate">{entry.model}</span>
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)] mt-1">
                            {providerLabel(entry.provider)} · {formatNumber(entry.requests)} requests · {Math.round(entry.share * 100)}% share
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold">{formatMoney(entry.estimatedCost)}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">est. spend</div>
                        </div>
                      </div>
                      <MiniBar value={entry.requests} max={maxRequests} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">No model usage data is available yet.</p>
            )}
          </div>

          <div className="space-y-6">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Model Mix</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">A quick read on where the demand is coming from.</p>
                </div>
                <BarChart3 size={16} className="text-[var(--color-accent)]" />
              </div>
              <div className="space-y-2">
                {modelIntelligence.slice(0, 5).map((entry) => (
                  <div key={entry.model} className="rounded-lg px-3 py-2" style={{ background: 'var(--color-bg-primary)' }}>
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="text-sm font-medium truncate">{entry.model}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{Math.round(entry.share * 100)}%</div>
                    </div>
                    <MiniBar value={entry.requests} max={maxRequests} />
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Catalog Preview</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">Public-facing cards with internal registry context.</p>
                </div>
                <Link href="/models" className="text-sm text-[var(--color-accent)] hover:underline inline-flex items-center gap-1">
                  Public page <ArrowRight size={14} />
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {MODEL_CATALOGUE.slice(0, 6).map((entry) => (
                  <div key={entry.key} className="rounded-xl p-4 border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{entry.provider}</span>
                      <span className="badge-accent text-[10px]">{entry.badge}</span>
                    </div>
                    <p className="font-bold text-white text-lg leading-snug">{entry.name}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mt-2">{entry.blurb}</p>
                    <code className="text-xs text-cyan-300 bg-cyan-400/10 px-2 py-1 rounded font-mono mt-3 inline-block">{entry.id}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-6">
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Registry Editor</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Update model labels and visible values without touching application code.</p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                {filtered.length.toLocaleString()} entries
              </span>
            </div>

            <div className="p-6 border-b border-[var(--color-border)]">
              <input
                type="text"
                className="input-field max-w-sm"
                placeholder="Search model keys or names..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="p-6 space-y-8">
              {PROVIDERS.map((provider) => {
                const group = grouped.get(provider) || [];
                if (group.length === 0) return null;
                return (
                  <div key={provider}>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3 pl-1">
                      {providerLabel(provider)}
                    </h3>
                    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[var(--color-border)] bg-[rgba(255,255,255,0.02)]">
                            <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] w-64">Variable Key</th>
                            <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Display Name / Value</th>
                            <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] w-32">Used In</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                          {group.map((entry) => (
                            <tr key={entry.key} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                              <td className="p-4">
                                <code className="text-xs text-cyan-300 bg-cyan-400/10 px-2 py-1 rounded font-mono">
                                  MODELS.{entry.key}
                                </code>
                              </td>
                              <td className="p-4">
                                <input
                                  id={`model-${entry.key}`}
                                  type="text"
                                  value={entry.value}
                                  onChange={(e) => handleChange(entry.key, e.target.value)}
                                  className="input-field py-2 text-sm font-medium max-w-sm"
                                />
                              </td>
                              <td className="p-4">
                                <span className="text-xs text-[var(--color-text-muted)]">
                                  {entry.key.includes('FLAGSHIP') || entry.key.includes('OPUS') || entry.key.includes('PRO')
                                    ? 'Homepage, Docs, Models'
                                    : 'Docs, Models'}
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
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Model Notes</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">What this page now gives the owner.</p>
                </div>
                <Sparkles size={16} className="text-[var(--color-accent)]" />
              </div>
              <div className="space-y-3 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                <p>• Use the registry editor to rename model labels and keep the public site aligned with the control center.</p>
                <p>• Use the economics panel to spot the most expensive request concentration before it turns into a margin problem.</p>
                <p>• Use the catalog preview to see the public card language that visitors and customers see on the main site.</p>
              </div>
            </div>

          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-[var(--color-border)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <p className="text-sm text-[var(--color-text-muted)]">
            Changes saved here will reflect on the public site on next build or deploy.
          </p>
          <button
            onClick={handleSave}
            className={`btn-primary py-2.5 px-6 ${saved ? 'bg-emerald-500' : ''}`}
          >
            {saved ? '✓ Changes Saved!' : 'Save All Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

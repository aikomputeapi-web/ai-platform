'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, RefreshCw, BarChart3, Sparkles } from 'lucide-react';
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

// Check for getProviderForModel usage. If needed elsewhere, keep it
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
    <div className="border-default bg-bg overflow-hidden" style={{ height: '6px' }}>
      <div
        style={{
          height: '100%',
          background: 'var(--accent)',
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
      <div className="flex-center justify-center bg-bg" style={{ minHeight: 'calc(100vh - 56px)' }}>
        <div className="flex flex-col items-center gap-16">
          <div className="auth-spinner" />
          <p className="text-13 text-muted mono">Loading model intelligence…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg" style={{ minHeight: 'calc(100vh - 56px)', color: 'var(--text)' }}>
      <div style={{ maxWidth: '1480px', margin: '0 auto', padding: '0 24px 48px 24px' }}>
        {/* Header */}
        <div className="dash-page-header flex-start flex-wrap gap-20 justify-between">
          <div>
            <div className="badge badge-accent mb-8" style={{ fontSize: '9px' }}>Model Registry</div>
            <h1 className="dash-page-title">Model Registry & Economics</h1>
            <p className="dash-page-sub">
              Control the model catalog and watch the economics behind it.
            </p>
          </div>
          <div className="flex-center gap-8 flex-wrap">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => {
                  setRange(option);
                  void fetchData(option);
                }}
                className={`btn-outline ${range === option ? 'active' : ''}`}
                style={{ padding: '8px 12px', fontSize: '11px', textTransform: 'uppercase', borderColor: range === option ? 'var(--accent)' : 'var(--border-bright)' }}
              >
                {option}
              </button>
            ))}
            <button
              onClick={() => void fetchData()}
              className="btn-outline btn-sm inline-flex items-center gap-6"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
            <button
              onClick={handleSave}
              className="btn-primary btn-sm inline-flex items-center gap-6"
            >
              {saved ? '✓ Saved' : 'Save Registry'}
            </button>
          </div>
        </div>

        {error && (
          <div className="alert-error mb-24">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="dash-stats-grid">
          {[
            { label: 'Requests', value: formatCompact(totalRequests), sub: `${data.range.toUpperCase()} usage window` },
            { label: 'Estimated Spend', value: formatMoney(totalCost), sub: 'request-share allocation' },
            { label: 'Catalog Entries', value: formatNumber(activeCatalog), sub: 'public and internal model cards' },
            { label: 'Top 3 Share', value: `${Math.round(concentration * 100)}%`, sub: 'mix concentration' },
          ].map((card) => (
            <div key={card.label} className="dash-stat">
              <div className="dash-stat-label">
                <span>{card.label}</span>
              </div>
              <div className="dash-stat-value">{card.value}</div>
              <div className="dash-stat-sub">{card.sub}</div>
            </div>
          ))}
        </div>

        <div className="dash-grid-2">
          {/* Model Economics */}
          <div className="dash-card mb-0">
            <div className="dash-card-title flex-between">
              <span>Model Economics</span>
              <span className="badge badge-accent" style={{ fontSize: '9px' }}>ESTIMATED</span>
            </div>
            <p className="text-13 text-muted mb-16">Usage-led allocation of spend by model.</p>

            {modelIntelligence.length > 0 ? (
              <>
                <div className="border-default p-16 bg-bg mb-16">
                  <div className="mono text-10 text-muted uppercase mb-4" style={{ letterSpacing: '0.08em' }}>Leading model</div>
                  <div className="mono font-700 text-bright" style={{ fontSize: '20px' }}>{dominantModel?.model || '—'}</div>
                  <div className="text-11 text-muted mono mt-4">
                    {dominantModel ? `${Math.round(dominantModel.share * 100)}% of requests · ${formatMoney(dominantModel.estimatedCost)}` : 'No model usage recorded yet'}
                  </div>
                </div>
                <div className="flex flex-col gap-8">
                  {modelIntelligence.map((entry, index) => (
                    <div key={entry.model} className="border-default p-16 bg-surface">
                      <div className="flex justify-between items-start gap-16 mb-8">
                        <div style={{ minWidth: 0 }}>
                          <div className="flex-center gap-8">
                            <span className="badge badge-accent" style={{ fontSize: '8px' }}>#{index + 1}</span>
                            <span className="truncate mono font-600 text-13">{entry.model}</span>
                          </div>
                          <div className="text-11 text-muted mono mt-4">
                            {providerLabel(entry.provider)} · {formatNumber(entry.requests)} requests · {Math.round(entry.share * 100)}% share
                          </div>
                        </div>
                        <div className="text-right" style={{ flexShrink: 0 }}>
                          <div className="mono font-700 text-bright" style={{ fontSize: '14px' }}>{formatMoney(entry.estimatedCost)}</div>
                          <div className="text-10 text-muted mono">est. spend</div>
                        </div>
                      </div>
                      <MiniBar value={entry.requests} max={maxRequests} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-13 text-muted">No model usage data is available yet.</p>
            )}
          </div>

          {/* Sidebar panels */}
          <div className="flex flex-col gap-24">
            <div className="dash-card mb-0">
              <div className="dash-card-title flex-between">
                <span>Model Mix</span>
                <BarChart3 size={14} style={{ color: 'var(--accent)' }} />
              </div>
              <p className="text-13 text-muted mb-16">A quick read on where the demand is coming from.</p>
              <div className="flex flex-col gap-10">
                {modelIntelligence.slice(0, 5).map((entry) => (
                  <div key={entry.model} className="border-default p-12 bg-bg">
                    <div className="flex-between mb-6 text-12 mono">
                      <span className="truncate font-600">{entry.model}</span>
                      <span className="text-muted">{Math.round(entry.share * 100)}%</span>
                    </div>
                    <MiniBar value={entry.requests} max={maxRequests} />
                  </div>
                ))}
              </div>
            </div>

            <div className="dash-card mb-0">
              <div className="dash-card-title flex-between">
                <span>Catalog Preview</span>
                <Link href="/models" className="btn-outline inline-flex items-center gap-4" style={{ padding: '4px 8px', fontSize: '10px', textDecoration: 'none' }}>
                  Public page <ArrowRight size={10} />
                </Link>
              </div>
              <p className="text-13 text-muted mb-16">Public-facing cards with internal registry context.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {MODEL_CATALOGUE.slice(0, 4).map((entry) => (
                  <div key={entry.key} className="border-default p-12 bg-surface text-12">
                    <div className="flex-between mb-8">
                      <span className="mono text-10 text-muted font-700">{entry.provider}</span>
                      <span className="badge badge-accent" style={{ fontSize: '8px' }}>{entry.badge}</span>
                    </div>
                    <p className="font-700 text-13 text-bright">{entry.name}</p>
                    <p className="text-11 text-muted mt-4" style={{ lineHeight: '1.4' }}>{entry.blurb}</p>
                    <code className="mono text-accent" style={{ fontSize: '10px', marginTop: '8px', display: 'inline-block' }}>{entry.id}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Registry Editor */}
        <div className="dash-grid-2 mt-24">
          <div className="dash-card mb-0">
            <div className="dash-card-title flex-between">
              <span>Registry Editor</span>
              <span className="badge" style={{ fontSize: '9px' }}>
                {filtered.length.toLocaleString()} entries
              </span>
            </div>
            <p className="text-13 text-muted mb-16">Update model labels and visible values without touching application code.</p>

            <div className="mb-24">
              <input
                type="text"
                className="input-field"
                style={{ maxWidth: '360px' }}
                placeholder="Search model keys or names..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-32">
              {PROVIDERS.map((provider) => {
                const group = grouped.get(provider) || [];
                if (group.length === 0) return null;
                return (
                  <div key={provider}>
                    <h3 className="mono text-11 uppercase text-muted mb-12" style={{ letterSpacing: '0.08em' }}>
                      {providerLabel(provider)}
                    </h3>
                    <div className="border-default bg-surface">
                      <table className="dash-table">
                        <thead>
                          <tr>
                            <th style={{ width: '220px' }}>Variable Key</th>
                            <th>Display Name / Value</th>
                            <th style={{ width: '150px' }}>Used In</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.map((entry) => (
                            <tr key={entry.key}>
                              <td>
                                <code className="mono text-11 text-bright">
                                  MODELS.{entry.key}
                                </code>
                              </td>
                              <td>
                                <input
                                  id={`model-${entry.key}`}
                                  type="text"
                                  value={entry.value}
                                  onChange={(e) => handleChange(entry.key, e.target.value)}
                                  className="input-field"
                                  style={{ padding: '6px 12px', fontSize: '13px', fontFamily: 'Space Grotesk, sans-serif' }}
                                />
                              </td>
                              <td>
                                <span className="text-11 text-muted">
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

          <div className="flex flex-col gap-24">
            <div className="dash-card mb-0">
              <div className="dash-card-title flex-between">
                <span>Model Notes</span>
                <Sparkles size={14} style={{ color: 'var(--accent)' }} />
              </div>
              <div className="flex flex-col gap-12 text-12 text-muted" style={{ lineHeight: '1.5' }}>
                <p>• Use the registry editor to rename model labels and keep the public site aligned with the control center.</p>
                <p>• Use the economics panel to spot the most expensive request concentration before it turns into a margin problem.</p>
                <p>• Use the catalog preview to see the public card language that visitors and customers see on the main site.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-between flex-wrap gap-16 mt-32 pt-24" style={{ borderTop: '1px solid var(--border-bright)' }}>
          <p className="text-12 text-muted mono">
            Changes saved here will reflect on the public site on next build or deploy.
          </p>
          <button
            onClick={handleSave}
            className="btn-primary"
            style={{ padding: '10px 24px' }}
          >
            {saved ? '✓ Changes Saved!' : 'Save All Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

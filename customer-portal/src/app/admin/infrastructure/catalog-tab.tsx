'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Layers, ToggleLeft, ToggleRight, Zap, Server, ChevronDown, ChevronRight } from 'lucide-react';

type ProviderEntry = {
  providerId: string;
  alias: string;
  prefixedId: string;
};

type CatalogEntry = {
  id: string;
  comboId: string;
  providers: ProviderEntry[];
  type: string;
  isVisible: boolean;
};

type CatalogData = {
  enabled: boolean;
  brand: string;
  providerOrder: string[];
  entries: CatalogEntry[];
  totalModels: number;
};

function ProviderBadge({ alias }: { alias: string }) {
  const colors: Record<string, string> = {
    kr: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    gh: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    ag: 'bg-green-500/10 text-green-400 border-green-500/20',
    cx: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    kiro: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    github: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    antigravity: 'bg-green-500/10 text-green-400 border-green-500/20',
    codex: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  };
  const style = colors[alias] || 'bg-[var(--color-accent-subtle)] text-[var(--color-text-secondary)] border-[var(--color-border)]';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${style}`}>
      {alias}
    </span>
  );
}

function ModelRow({ entry, expanded, onToggle }: { entry: CatalogEntry; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 cursor-pointer text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? <ChevronDown size={14} className="text-[var(--color-text-muted)] shrink-0" /> : <ChevronRight size={14} className="text-[var(--color-text-muted)] shrink-0" />}
          <code className="text-sm font-mono font-bold text-white truncate">{entry.id}</code>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-[var(--color-text-muted)]">
            {entry.providers.length} provider{entry.providers.length !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-1">
            {entry.providers.slice(0, 4).map((p) => (
              <ProviderBadge key={p.prefixedId} alias={p.alias} />
            ))}
            {entry.providers.length > 4 && (
              <span className="text-[10px] text-[var(--color-text-muted)]">
                +{entry.providers.length - 4}
              </span>
            )}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="px-5 pb-4 pt-0">
          <div className="border-t border-[var(--color-border)] pt-3 space-y-2">
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-2">
              Provider Priority (tried in order)
            </div>
            {entry.providers.map((p, idx) => (
              <div
                key={p.prefixedId}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--color-bg-primary)]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--color-text-muted)] w-5 text-center font-bold">
                    {idx + 1}
                  </span>
                  <ProviderBadge alias={p.alias} />
                  <code className="text-xs text-[var(--color-text-secondary)] font-mono">{p.prefixedId}</code>
                </div>
                {idx === 0 && <span className="badge-success text-[10px]">Primary</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CatalogAdminTab() {
  const [data, setData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/virtual-catalog');
      if (!res.ok) {
        setError('Failed to load catalog');
        return;
      }
      setData(await res.json());
      setError('');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    setSuccessMessage('');
    try {
      const res = await fetch('/api/admin/virtual-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error?.message || 'Failed to generate catalog');
        return;
      }
      setSuccessMessage(`Catalog generated: ${result.created} models created, ${result.deleted} old entries cleaned up.`);
      await fetchData();
    } catch {
      setError('Network error during generation');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggle = async () => {
    if (!data) return;
    setToggling(true);
    setError('');
    try {
      const res = await fetch('/api/admin/virtual-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', enabled: !data.enabled }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error?.message || 'Failed to toggle');
        return;
      }
      setData((prev) => prev ? { ...prev, enabled: result.enabled } : null);
      setSuccessMessage(`Virtual catalog ${result.enabled ? 'enabled' : 'disabled'}.`);
    } catch {
      setError('Network error');
    } finally {
      setToggling(false);
    }
  };

  const filtered = useMemo(() => {
    if (!data?.entries) return [];
    if (!search.trim()) return data.entries;
    const q = search.toLowerCase();
    return data.entries.filter(
      (e) =>
        e.id.toLowerCase().includes(q) ||
        e.providers.some(
          (p) =>
            p.alias.toLowerCase().includes(q) ||
            p.prefixedId.toLowerCase().includes(q)
        )
    );
  }, [data, search]);

  const uniqueProviders = useMemo(() => {
    if (!data?.entries) return [];
    const seen = new Set<string>();
    for (const e of data.entries) {
      for (const p of e.providers) {
        seen.add(p.alias);
      }
    }
    return Array.from(seen).sort();
  }, [data]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  if (loading || !data) {
    return (
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading customer catalog…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        {/* Hero */}
        <div className="glass-card p-6 mb-8 border border-[var(--color-border)] relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at top right, rgba(99,102,241,0.08), transparent 35%)',
            }}
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-accent-subtle)] text-white text-xs font-semibold uppercase tracking-wider mb-4 border border-[var(--color-border)]">
                Customer Catalog
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05] mb-3">
                Control what models your customers see.
              </h1>
              <p className="text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
                The virtual catalog replaces the raw provider-prefixed model list with a clean, deduplicated view.
                Each model appears once, and requests are automatically routed to the best available provider with failover.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleToggle}
                disabled={toggling}
                className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer inline-flex items-center gap-2 ${
                  data.enabled
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                    : 'bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-white hover:bg-[var(--color-bg-card-hover)]'
                }`}
              >
                {data.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                {toggling ? 'Updating…' : data.enabled ? 'Enabled' : 'Disabled'}
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-2 rounded-lg text-xs font-semibold border border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-card-hover)] transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
                {generating ? 'Generating…' : 'Regenerate Catalog'}
              </button>
              <button
                type="button"
                onClick={() => void fetchData()}
                className="px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-card-hover)] transition-all cursor-pointer"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 text-sm">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-6 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-200 text-sm">
            {successMessage}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Status',
              value: data.enabled ? 'Active' : 'Off',
              sub: data.enabled ? 'Customers see clean list' : 'Customers see raw providers',
              color: data.enabled ? '#34d399' : '#a1a1aa',
            },
            { label: 'Virtual Models', value: String(data.totalModels), sub: 'unique models in catalog', color: '#ffffff' },
            { label: 'Providers', value: String(uniqueProviders.length), sub: uniqueProviders.slice(0, 3).join(', ') || 'none', color: '#a1a1aa' },
            { label: 'Brand', value: data.brand, sub: 'owned_by in API response', color: '#71717a' },
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

        <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-6">
          {/* Model list */}
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Model Catalog</h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Each model below appears once in the customer&apos;s <code className="text-xs bg-[var(--color-bg-primary)] px-1.5 py-0.5 rounded">/v1/models</code> response.
                </p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                {filtered.length} model{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="p-4 border-b border-[var(--color-border)]">
              <input
                type="text"
                className="input-field max-w-sm"
                placeholder="Search models or providers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
              {filtered.length > 0 ? (
                filtered.map((entry) => (
                  <ModelRow
                    key={entry.id}
                    entry={entry}
                    expanded={expandedIds.has(entry.id)}
                    onToggle={() => toggleExpand(entry.id)}
                  />
                ))
              ) : data.entries.length === 0 ? (
                <div className="text-center py-12">
                  <Layers size={32} className="mx-auto mb-3 text-[var(--color-text-muted)]" />
                  <p className="text-sm text-[var(--color-text-muted)] mb-4">
                    No virtual catalog entries yet.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="btn-primary text-sm px-5 py-2.5"
                  >
                    <Zap size={14} className="inline mr-1.5" />
                    Generate Catalog Now
                  </button>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
                  No models match &quot;{search}&quot;
                </p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold">How It Works</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">What happens when you enable the virtual catalog.</p>
                </div>
                <Server size={16} className="text-[var(--color-accent)]" />
              </div>
              <div className="space-y-4 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                <div className="rounded-xl p-4 bg-[var(--color-bg-primary)]">
                  <div className="font-semibold text-white mb-1">1. Clean Model List</div>
                  <p>Customers calling <code className="text-xs bg-[var(--color-bg-secondary)] px-1 rounded">GET /v1/models</code> see each model once without provider prefixes.</p>
                </div>
                <div className="rounded-xl p-4 bg-[var(--color-bg-primary)]">
                  <div className="font-semibold text-white mb-1">2. Automatic Failover</div>
                  <p>When a customer uses <code className="text-xs bg-[var(--color-bg-secondary)] px-1 rounded">claude-sonnet-4-6</code>, the system tries providers in priority order until one succeeds.</p>
                </div>
                <div className="rounded-xl p-4 bg-[var(--color-bg-primary)]">
                  <div className="font-semibold text-white mb-1">3. No Code Changes</div>
                  <p>Customers don&apos;t need to change anything. Their existing API calls work — they just see cleaner model names.</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Active Providers</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">Providers backing the virtual catalog.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {uniqueProviders.length > 0 ? (
                  uniqueProviders.map((alias) => (
                    <ProviderBadge key={alias} alias={alias} />
                  ))
                ) : (
                  <p className="text-sm text-[var(--color-text-muted)]">No providers detected. Generate the catalog first.</p>
                )}
              </div>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Quick Actions</h2>
                </div>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full px-4 py-3 rounded-lg text-sm font-semibold border border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-card-hover)] transition-all cursor-pointer text-left inline-flex items-center gap-2"
                >
                  <Zap size={14} />
                  Regenerate from current providers
                </button>
                <button
                  type="button"
                  onClick={handleToggle}
                  disabled={toggling}
                  className="w-full px-4 py-3 rounded-lg text-sm font-semibold border border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-card-hover)] transition-all cursor-pointer text-left inline-flex items-center gap-2"
                >
                  {data.enabled ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                  {data.enabled ? 'Disable virtual catalog' : 'Enable virtual catalog'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  return (
    <span className="badge">
      {alias}
    </span>
  );
}

function ModelRow({ entry, expanded, onToggle }: { entry: CatalogEntry; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="border-default bg-surface mb-8">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex-between gap-12"
        style={{ padding: '12px 16px', background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', textAlign: 'left' }}
      >
        <div className="flex-center gap-8" style={{ minWidth: 0 }}>
          {expanded ? <ChevronDown size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />}
          <code className="mono text-13 font-700 text-bright truncate">{entry.id}</code>
        </div>
        <div className="flex-center gap-8" style={{ flexShrink: 0 }}>
          <span className="text-11 text-muted mono">
            {entry.providers.length} provider{entry.providers.length !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-4">
            {entry.providers.slice(0, 4).map((p) => (
              <ProviderBadge key={p.prefixedId} alias={p.alias} />
            ))}
            {entry.providers.length > 4 && (
              <span className="text-10 text-muted mono">
                +{entry.providers.length - 4}
              </span>
            )}
          </div>
        </div>
      </button>
      {expanded && (
        <div style={{ padding: '0 16px 16px 16px' }}>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <div className="mono text-10 uppercase text-muted mb-8 font-600" style={{ letterSpacing: '0.08em' }}>
              Provider Priority (tried in order)
            </div>
            <div className="flex flex-col gap-6">
              {entry.providers.map((p, idx) => (
                <div
                  key={p.prefixedId}
                  className="flex-between border-default bg-bg"
                  style={{ padding: '8px 12px' }}
                >
                  <div className="flex-center gap-12">
                    <span className="mono text-11 text-muted font-700" style={{ width: '16px', textAlign: 'center' }}>
                      {idx + 1}
                    </span>
                    <ProviderBadge alias={p.alias} />
                    <code className="mono text-11 text-muted">{p.prefixedId}</code>
                  </div>
                  {idx === 0 && <span className="badge badge-success" style={{ fontSize: '8px' }}>Primary</span>}
                </div>
              ))}
            </div>
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
  const [warnings, setWarnings] = useState<string[]>([]);
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
    setWarnings([]);
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
      if (Array.isArray(result.warnings) && result.warnings.length > 0) {
        setWarnings(result.warnings);
      }
      if (Array.isArray(result.errors) && result.errors.length > 0) {
        setError(`${result.errors.length} error(s): ${result.errors.join('; ')}`);
      }
      if (result.created > 0) {
        setSuccessMessage(`Catalog generated: ${result.created} models created, ${result.deleted} old entries cleaned up.`);
      } else if (!result.warnings?.length && !result.errors?.length) {
        setSuccessMessage('Catalog regenerated — no changes needed.');
      }
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
      <div className="flex-center justify-center bg-bg" style={{ minHeight: 'calc(100vh - 56px)' }}>
        <div className="flex flex-col items-center gap-16">
          <div className="auth-spinner" />
          <p className="text-13 text-muted mono">Loading virtual catalog…</p>
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
            <div className="badge badge-accent mb-8" style={{ fontSize: '9px' }}>Customer Catalog</div>
            <h1 className="dash-page-title">Control customer models</h1>
            <p className="dash-page-sub">
              The virtual catalog replaces raw provider-prefixed lists with a clean, routed view.
            </p>
          </div>
          <div className="flex-center gap-8 flex-wrap">
            <button
              type="button"
              onClick={handleToggle}
              disabled={toggling}
              className="btn-outline btn-sm inline-flex items-center gap-6"
            >
              {data.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              {toggling ? 'Updating…' : data.enabled ? 'Enabled' : 'Disabled'}
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="btn-primary btn-sm inline-flex items-center gap-6"
            >
              <RefreshCw size={12} className={generating ? 'animate-spin' : ''} />
              {generating ? 'Generating…' : 'Regenerate Catalog'}
            </button>
            <button
              type="button"
              onClick={() => void fetchData()}
              className="btn-outline btn-sm inline-flex items-center"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="alert-error mb-24">
            {error}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="alert-warning mb-24">
            <div className="font-700 mb-6">Warnings:</div>
            {warnings.map((w, i) => (
              <div key={i}>· {w}</div>
            ))}
          </div>
        )}
        {successMessage && (
          <div className="alert-success mb-24">
            {successMessage}
          </div>
        )}

        {/* Stats */}
        <div className="dash-stats-grid">
          <div className="dash-stat">
            <div className="dash-stat-label">
              <span>Status</span>
              <span style={{ color: data.enabled ? 'var(--accent)' : 'var(--muted)' }}>●</span>
            </div>
            <div className="dash-stat-value">{data.enabled ? 'Active' : 'Off'}</div>
            <div className="dash-stat-sub">{data.enabled ? 'Clean /v1/models active' : 'Raw provider names exposed'}</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat-label">Virtual Models</div>
            <div className="dash-stat-value">{data.totalModels}</div>
            <div className="dash-stat-sub">unique models in catalog</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat-label">Providers</div>
            <div className="dash-stat-value">{uniqueProviders.length}</div>
            <div className="dash-stat-sub">{uniqueProviders.slice(0, 3).join(', ') || 'none'}</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat-label">Brand prefix</div>
            <div className="dash-stat-value uppercase">{data.brand}</div>
            <div className="dash-stat-sub">owned_by in API response</div>
          </div>
        </div>

        <div className="dash-grid-2">
          {/* Model list */}
          <div className="dash-card mb-0">
            <div className="dash-card-title flex-between">
              <span>Model Catalog</span>
              <span className="badge font-mono-brand" style={{ fontSize: '9px' }}>
                {filtered.length} model{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-13 text-muted mb-16">
              Each model below appears once in the customer&apos;s <code className="mono" style={{ fontSize: '11px', background: 'var(--surface)', padding: '2px 6px', border: '1px solid var(--border)' }}>/v1/models</code> response.
            </p>

            <div className="mb-16">
              <input
                type="text"
                className="input-field"
                style={{ maxWidth: '360px' }}
                placeholder="Search models or providers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-col" style={{ maxHeight: '600px', overflowY: 'auto' }}>
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
                <div className="text-center" style={{ padding: '48px 0' }}>
                  <Layers size={32} style={{ margin: '0 auto 12px', color: 'var(--muted)' }} />
                  <p className="text-13 text-muted mb-16">
                    No virtual catalog entries yet.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="btn-accent btn-sm"
                  >
                    <Zap size={12} className="inline mr-1.5" />
                    Generate Catalog Now
                  </button>
                </div>
              ) : (
                <p className="text-13 text-muted text-center" style={{ padding: '24px 0' }}>
                  No models match &quot;{search}&quot;
                </p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-24">
            <div className="dash-card mb-0">
              <div className="dash-card-title">How It Works</div>
              <div className="flex flex-col gap-12">
                <div className="border-default p-12 bg-bg">
                  <div className="font-700 text-12 text-bright mb-4">1. Clean Model List</div>
                  <p className="text-11 text-muted" style={{ lineHeight: '1.4' }}>
                    Customers calling <code className="mono text-10 bg-surface" style={{ padding: '1px 3px' }}>GET /v1/models</code> see each model once without provider prefixes.
                  </p>
                </div>
                <div className="border-default p-12 bg-bg">
                  <div className="font-700 text-12 text-bright mb-4">2. Automatic Failover</div>
                  <p className="text-11 text-muted" style={{ lineHeight: '1.4' }}>
                    When a customer uses <code className="mono text-10 bg-surface" style={{ padding: '1px 3px' }}>claude-sonnet-4-6</code>, the system tries providers in priority order until one succeeds.
                  </p>
                </div>
                <div className="border-default p-12 bg-bg">
                  <div className="font-700 text-12 text-bright mb-4">3. No Code Changes</div>
                  <p className="text-11 text-muted" style={{ lineHeight: '1.4' }}>
                    Customers don&apos;t need to change anything. Their existing API calls work — they just see cleaner model names.
                  </p>
                </div>
              </div>
            </div>

            <div className="dash-card mb-0">
              <div className="dash-card-title">Active Providers</div>
              <div className="flex flex-wrap gap-6">
                {uniqueProviders.length > 0 ? (
                  uniqueProviders.map((alias) => (
                    <ProviderBadge key={alias} alias={alias} />
                  ))
                ) : (
                  <p className="text-11 text-muted">No providers detected. Generate the catalog first.</p>
                )}
              </div>
            </div>

            <div className="dash-card mb-0">
              <div className="dash-card-title">Quick Actions</div>
              <div className="flex flex-col gap-8">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="btn-outline w-full flex-center gap-8 text-12"
                  style={{ textAlign: 'left', padding: '12px' }}
                >
                  <Zap size={14} />
                  Regenerate from current providers
                </button>
                <button
                  type="button"
                  onClick={handleToggle}
                  disabled={toggling}
                  className="btn-outline w-full flex-center gap-8 text-12"
                  style={{ textAlign: 'left', padding: '12px' }}
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

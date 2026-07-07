'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Database, Play, RefreshCw, Settings2, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react';
import {
  DEFAULT_PROXY_SETTINGS,
  type ProxyControlSource,
  type ProxyControlSnapshot,
  type ProxyManualAction,
  type ProxyPoolRow,
  type ProxySettings,
  type ProxyTier,
} from '@/lib/proxy-control';

type Snapshot = ProxyControlSnapshot;

const TIER_CONFIG: Array<{ id: ProxyTier; label: string; title: string; empty: string }> = [
  {
    id: 'tier1',
    label: 'Tier 1 Intake',
    title: 'Tier 1 Intake / Free Pool',
    empty: 'No Tier 1 free proxy intake rows.',
  },
  {
    id: 'tier2',
    label: 'Tier 2 Candidates',
    title: 'Tier 2 Verified Candidates',
    empty: 'No Tier 2 verified candidate rows.',
  },
  {
    id: 'tier3',
    label: 'Tier 3 Active Pool',
    title: 'Tier 3 Active Global Proxy Pool',
    empty: 'No active global proxy rows.',
  },
];

function formatPercent(value: number | null) {
  return typeof value === 'number' ? `${value}%` : '—';
}

function formatLatency(value: number | null) {
  return typeof value === 'number' ? `${value} ms` : '—';
}

function qualityBadge(value: number | null) {
  if (typeof value !== 'number') return 'badge';
  if (value >= 90) return 'badge-success';
  if (value >= 70) return 'badge-warning';
  return 'badge-danger';
}

function sourceBadge(source: ProxyControlSource) {
  return source === 'omniroute' ? 'badge-success' : 'badge-warning';
}

function sourceLabel(source: ProxyControlSource) {
  return source === 'omniroute' ? 'OmniRoute (live)' : 'Source unavailable';
}

const EMPTY_SNAPSHOT: Snapshot = {
  tiers: { tier1: [], tier2: [], tier3: [] },
  settings: { ...DEFAULT_PROXY_SETTINGS, providers: { ...DEFAULT_PROXY_SETTINGS.providers } },
  source: 'unavailable',
  counts: { tier1: 0, tier2: 0, tier3: 0 },
  globalPoolCount: 0,
  lastSyncedAt: null,
};

function ProxyTierTable({
  tierLabel,
  rows,
  selectedKeys,
  onToggleRow,
  onToggleAllInTier,
  emptyText,
}: {
  tierLabel: string;
  rows: ProxyPoolRow[];
  selectedKeys: Set<string>;
  onToggleRow: (selectionKey: string) => void;
  onToggleAllInTier: (rows: ProxyPoolRow[]) => void;
  emptyText: string;
}) {
  const selectedInTier = rows.filter((row) => selectedKeys.has(row.selectionKey)).length;
  const allSelected = rows.length > 0 && selectedInTier === rows.length;

  return (
    <div className="dash-card mb-12 p-0 overflow-hidden">
      <div className="dash-card-title flex-between" style={{ padding: '12px 24px' }}>
        <span className="font-600 text-14">{tierLabel}</span>
        <span className="badge badge-accent">{selectedInTier}/{rows.length} selected</span>
      </div>
      <div className="overflow-x-auto">
        <table className="dash-table">
          <thead>
            <tr>
              <th style={{ width: '48px', paddingLeft: '24px' }}>
                <input
                  type="checkbox"
                  aria-label={`Select all in ${tierLabel}`}
                  checked={allSelected}
                  disabled={rows.length === 0}
                  onChange={() => onToggleAllInTier(rows)}
                  style={{ width: '16px', height: '16px', cursor: rows.length > 0 ? 'pointer' : 'not-allowed' }}
                />
              </th>
              <th>Proxy</th>
              <th>Provider</th>
              <th className="text-right">Quality</th>
              <th className="text-right">Success</th>
              <th className="text-right">Latency</th>
              <th className="text-right">Tests</th>
              <th className="text-right" style={{ paddingRight: '24px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((row) => (
              <tr key={row.selectionKey}>
                <td style={{ paddingLeft: '24px' }}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.host}:${row.port}`}
                    checked={selectedKeys.has(row.selectionKey)}
                    onChange={() => onToggleRow(row.selectionKey)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </td>
                <td>
                  <div className="font-600 mono">{row.host}:{row.port}</div>
                  <div className="text-10 text-muted mono mt-4">{row.type.toUpperCase()} · {row.countryCode || 'ALL'} · {row.sourceId}</div>
                </td>
                <td className="font-600">{row.provider}</td>
                <td className="text-right"><span className={`badge ${qualityBadge(row.qualityScore)}`}>{row.qualityScore ?? '—'}</span></td>
                <td className="text-right mono">{formatPercent(row.successRate)}</td>
                <td className="text-right mono">{formatLatency(row.latencyMs)}</td>
                <td className="text-right mono">{row.testCount.toLocaleString()}</td>
                <td className="text-right" style={{ paddingRight: '24px' }}>
                  <span className="badge badge-accent">{row.status}</span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} className="text-center text-muted" style={{ padding: '24px' }}>{emptyText}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type AsyncState = 'idle' | 'pending' | 'ok' | 'error';

export default function ProxyControlCenterTab() {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [snapshot, setSnapshot] = useState<Snapshot>(() => EMPTY_SNAPSHOT);
  const [loadState, setLoadState] = useState<AsyncState>('idle');
  const [loadError, setLoadError] = useState('');
  const [settings, setSettings] = useState<ProxySettings>(() => ({
    ...DEFAULT_PROXY_SETTINGS,
    providers: { ...DEFAULT_PROXY_SETTINGS.providers },
  }));
  const [saveState, setSaveState] = useState<AsyncState>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [actionState, setActionState] = useState<{ active: boolean; last: string | null }>({
    active: false,
    last: null,
  });

  const rowsByTier = useMemo(
    () => ({
      tier1: snapshot.tiers.tier1,
      tier2: snapshot.tiers.tier2,
      tier3: snapshot.tiers.tier3,
    }),
    [snapshot],
  );

  // Flatten all rows across tiers for the global select-all.
  const allRows = useMemo(
    () => [...snapshot.tiers.tier1, ...snapshot.tiers.tier2, ...snapshot.tiers.tier3],
    [snapshot],
  );

  const activeProviders = Object.values(settings.providers).filter(Boolean).length;

  const fetchSnapshot = useCallback(async () => {
    setLoadState('pending');
    try {
      const res = await fetch('/api/admin/proxy-control', { cache: 'no-store' });
      if (!res.ok) {
        setLoadState('error');
        setLoadError(`Failed to load proxy snapshot (${res.status})`);
        return;
      }
      const data = (await res.json()) as Snapshot;
      setSnapshot(data);
      // Adopt server-reported settings, defensively against malformed payloads.
      setSettings((prev) => {
        const incoming = { ...data.settings };
        if (!incoming.providers || Object.keys(incoming.providers).length === 0) {
          incoming.providers = { ...prev.providers };
        }
        return incoming;
      });
      setLoadState('ok');
      setLoadError('');
    } catch {
      setLoadState('error');
      setLoadError('Network error while loading proxy snapshot');
    }
  }, []);

  useEffect(() => {
    void fetchSnapshot();
  }, [fetchSnapshot]);

  // Drop selection keys that no longer exist after a refresh so we never send
  // stale `tier:sourceId` pairs to the actions endpoint.
  useEffect(() => {
    if (selectedKeys.size === 0) return;
    const valid = new Set(allRows.map((row) => row.selectionKey));
    const pruned = new Set<string>();
    let changed = false;
    for (const key of selectedKeys) {
      if (valid.has(key)) {
        pruned.add(key);
      } else {
        changed = true;
      }
    }
    if (changed) setSelectedKeys(pruned);
    // Depends only on the underlying row identities, not the selection object reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, selectedKeys.size]);

  function toggleRow(selectionKey: string) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(selectionKey)) {
        next.delete(selectionKey);
      } else {
        next.add(selectionKey);
      }
      return next;
    });
  }

  function toggleAllInTier(rows: ProxyPoolRow[]) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      const allSelected = rows.length > 0 && rows.every((row) => next.has(row.selectionKey));
      rows.forEach((row) => {
        if (allSelected) {
          next.delete(row.selectionKey);
        } else {
          next.add(row.selectionKey);
        }
      });
      return next;
    });
  }

  /** Global select-all that spans every tier. */
  function toggleSelectAll() {
    setSelectedKeys((current) => {
      const allSelected =
        allRows.length > 0 && allRows.every((row) => current.has(row.selectionKey));
      const next = new Set(current);
      if (allSelected) {
        allRows.forEach((row) => next.delete(row.selectionKey));
      } else {
        allRows.forEach((row) => next.add(row.selectionKey));
      }
      return next;
    });
  }

  async function runAction(action: ProxyManualAction) {
    setActionState({ active: true, last: null });
    const keys = Array.from(selectedKeys);
    try {
      const res = await fetch('/api/admin/proxy-control/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, selectionKeys: keys }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        applied?: number;
        skipped?: number;
        error?: string;
      };
      if (!res.ok) {
        setActionState({
          active: false,
          last: `Failed: ${body.error || res.status}`,
        });
        return;
      }
      const summary = `Applied ${body.applied ?? 0}, skipped ${body.skipped ?? 0}`;
      setActionState({ active: false, last: summary });
      // Mirror the operations/routing pattern: refresh state after any mutation.
      await fetchSnapshot();
    } catch {
      setActionState({ active: false, last: 'Network error' });
    }
  }

  async function runTick(kind: 'run-check' | 'run-sync') {
    setActionState({ active: true, last: null });
    try {
      const res = await fetch('/api/admin/proxy-control/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: kind, selectionKeys: [] }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionState({ active: false, last: `Tick failed: ${body.error || res.status}` });
        return;
      }
      setActionState({ active: false, last: `${kind} submitted` });
      await fetchSnapshot();
    } catch {
      setActionState({ active: false, last: 'Network error' });
    }
  }

  async function saveSettings() {
    setSaveState('pending');
    setSaveMessage('');
    try {
      const res = await fetch('/api/admin/proxy-control/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; settings?: ProxySettings };
      if (!res.ok) {
        setSaveState('error');
        setSaveMessage(body.error || `Save failed (${res.status})`);
        return;
      }
      setSaveState('ok');
      setSaveMessage('Settings saved');
      // Adopt authoritative settings from the response snapshot if present.
      if (body.settings) {
        setSettings((prev) => ({
          ...body.settings!,
          providers: body.settings!.providers && Object.keys(body.settings!.providers).length > 0
            ? body.settings!.providers
            : prev.providers,
        }));
      }
    } catch {
      setSaveState('error');
      setSaveMessage('Network error while saving settings');
    }
  }

  const loading = loadState === 'pending';
  const totalSelected = selectedKeys.size;
  const globalAllSelected = allRows.length > 0 && totalSelected === allRows.length;
  const source = snapshot.source || 'unavailable';

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="dash-page-header flex flex-wrap gap-20" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className="badge badge-accent mb-8" style={{ fontSize: '9px' }}>Proxy System</div>
          <h1 className="dash-page-title">Proxy Control Center</h1>
          <p className="dash-page-sub">Three-tier proxy intake, candidate review, global pool visibility, and job settings.</p>
        </div>
        <div className="flex gap-8">
          <button
            type="button"
            className="btn-border btn-small inline-flex items-center gap-6"
            onClick={() => void fetchSnapshot()}
            disabled={loading}
            title="Refresh snapshot"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-6"
            onClick={() => void runTick('run-check')}
            disabled={actionState.active}
            title="Trigger proxy check tick on the owning service"
            style={{ padding: '6px 12px', fontSize: '11px' }}
          >
            <Play size={12} />
            Run Check Tick
          </button>
          <button
            type="button"
            className="btn-border btn-small inline-flex items-center gap-6"
            onClick={() => void runTick('run-sync')}
            disabled={actionState.active}
            title="Trigger proxy sync tick on the owning service"
          >
            <SlidersHorizontal size={12} />
            Run Sync
          </button>
        </div>
      </div>

      {(loadError || actionState.last) && (
        <div className="mt-12 text-12" style={{ color: loadError ? '#ef4444' : 'var(--muted)' }}>
          {loadError ? loadError : actionState.last}
        </div>
      )}

      {/* ── Stats Cards ── */}
      <div className="dash-stats-grid mb-24" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {[
          { label: 'Tier 1 Intake', value: snapshot.counts.tier1.toLocaleString(), sub: 'free pool rows', color: 'var(--text)' },
          { label: 'Tier 2 Candidates', value: snapshot.counts.tier2.toLocaleString(), sub: 'verified candidates', color: '#f59e0b' },
          { label: 'Tier 3 Active Pool', value: snapshot.counts.tier3.toLocaleString(), sub: 'global proxy rows', color: 'var(--accent)' },
          { label: 'Selected', value: totalSelected.toLocaleString(), sub: 'across all tiers', color: '#3b82f6' },
          {
            label: 'Backend State',
            value: source === 'omniroute' ? 'Live' : 'Unavailable',
            sub: sourceLabel(source),
            color: source === 'omniroute' ? 'var(--accent)' : 'var(--muted)',
          },
        ].map((card) => (
          <div key={card.label} className="dash-stat">
            <div className="dash-stat-label"><span>{card.label}</span><span style={{ color: card.color }}>●</span></div>
            <div className="dash-stat-value" style={{ color: card.color }}>{card.value}</div>
            <div className="dash-stat-sub">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Global Select + Actions Toolbar ── */}
      <div className="dash-card mb-12" style={{ padding: '12px 24px' }}>
        <div className="flex flex-wrap gap-12" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="flex gap-12" style={{ alignItems: 'center' }}>
            <label className="flex gap-6" style={{ alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                aria-label="Select all proxies across all tiers"
                checked={globalAllSelected}
                disabled={allRows.length === 0}
                onChange={toggleSelectAll}
                style={{ width: '18px', height: '18px', cursor: allRows.length > 0 ? 'pointer' : 'not-allowed' }}
              />
              <span className="text-12 font-600">Select all</span>
            </label>
            <span className="text-10 text-muted">
              {totalSelected} / {allRows.length} selected
            </span>
          </div>

          <div className="flex gap-8 flex-wrap">
            <button
              type="button"
              className="btn-outline btn-small"
              disabled={actionState.active || selectedKeys.size === 0}
              onClick={() => void runAction('promote')}
              title="Promote selected rows toward the global pool"
            >
              Promote
            </button>
            <button
              type="button"
              className="btn-outline btn-small"
              disabled={actionState.active || selectedKeys.size === 0}
              onClick={() => void runAction('demote')}
              title="Demote selected rows back to review"
            >
              Demote
            </button>
            <button
              type="button"
              className="btn-outline btn-small"
              disabled={actionState.active || selectedKeys.size === 0}
              onClick={() => void runAction('quarantine')}
              title="Quarantine selected rows (best-effort)"
            >
              Quarantine
            </button>
            <button
              type="button"
              className="btn-danger-sm inline-flex items-center gap-4"
              disabled={actionState.active || selectedKeys.size === 0}
              onClick={() => void runAction('remove')}
              title="Delete selected rows from the pool"
            >
              <Trash2 size={12} />
              Delete selected
            </button>
          </div>
        </div>
      </div>

      {/* ── Three Tier Tables ── */}
      {TIER_CONFIG.map((cfg) => (
        <ProxyTierTable
          key={cfg.id}
          tierLabel={cfg.label}
          rows={rowsByTier[cfg.id]}
          selectedKeys={selectedKeys}
          onToggleRow={toggleRow}
          onToggleAllInTier={toggleAllInTier}
          emptyText={cfg.empty}
        />
      ))}

      {/* ── Settings Section ── */}
      <div className="dash-grid-2" style={{ marginTop: '24px' }}>
        <div className="dash-card mb-0">
          <div className="dash-card-title flex-between">
            <span>System Settings</span>
            <Settings2 size={14} className="text-accent" />
          </div>
          <div className="dash-stack">
            <label className="flex-between" style={{ padding: '12px', border: '1px solid var(--border)', background: 'var(--bg)' }}>
              <div>
                <div className="font-600 text-12">Background job enabled</div>
                <div className="text-10 text-muted mono mt-4">Persisted to the owning free-proxy service</div>
              </div>
              <input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} style={{ width: '18px', height: '18px' }} />
            </label>
            <div className="dash-grid-1-1" style={{ gap: '12px' }}>
              <label>
                <span className="auth-label">Check interval minutes</span>
                <input className="input-field" type="number" min={1} value={settings.checkIntervalMinutes} onChange={(event) => setSettings({ ...settings, checkIntervalMinutes: Number(event.target.value) })} />
              </label>
              <label>
                <span className="auth-label">Sync interval minutes</span>
                <input className="input-field" type="number" min={1} value={settings.syncIntervalMinutes} onChange={(event) => setSettings({ ...settings, syncIntervalMinutes: Number(event.target.value) })} />
              </label>
              <label>
                <span className="auth-label">Country filter</span>
                <input className="input-field" value={settings.countryFilter} onChange={(event) => setSettings({ ...settings, countryFilter: event.target.value.toUpperCase() })} />
              </label>
              <label>
                <span className="auth-label">Target pool size</span>
                <input className="input-field" type="number" min={1} value={settings.poolSize} onChange={(event) => setSettings({ ...settings, poolSize: Number(event.target.value) })} />
              </label>
            </div>
            <div className="dash-grid-3" style={{ gap: '12px' }}>
              <label>
                <span className="auth-label">Min quality</span>
                <input className="input-field" type="number" min={0} max={100} value={settings.minQuality} onChange={(event) => setSettings({ ...settings, minQuality: Number(event.target.value) })} />
              </label>
              <label>
                <span className="auth-label">Min success %</span>
                <input className="input-field" type="number" min={0} max={100} value={settings.minSuccessRate} onChange={(event) => setSettings({ ...settings, minSuccessRate: Number(event.target.value) })} />
              </label>
              <label>
                <span className="auth-label">Min tests</span>
                <input className="input-field" type="number" min={0} value={settings.minTests} onChange={(event) => setSettings({ ...settings, minTests: Number(event.target.value) })} />
              </label>
            </div>
            <div className="dash-grid-3" style={{ gap: '12px' }}>
              <label>
                <span className="auth-label">Tier 1 → 2 threshold</span>
                <input className="input-field" type="number" min={1} value={settings.tier1PromoteThreshold} onChange={(event) => setSettings({ ...settings, tier1PromoteThreshold: Number(event.target.value) })} title="Consecutive successes before a Tier 1 proxy is promoted to Tier 2" />
              </label>
              <label>
                <span className="auth-label">Tier 2 → 3 threshold</span>
                <input className="input-field" type="number" min={1} value={settings.tier2PromoteThreshold} onChange={(event) => setSettings({ ...settings, tier2PromoteThreshold: Number(event.target.value) })} title="Consecutive successes before a Tier 2 proxy is promoted to Tier 3 (active pool)" />
              </label>
              <label>
                <span className="auth-label">Tier 2 demote threshold</span>
                <input className="input-field" type="number" min={1} value={settings.tier2DemoteThreshold} onChange={(event) => setSettings({ ...settings, tier2DemoteThreshold: Number(event.target.value) })} title="Consecutive failures before a Tier 2 proxy is demoted back to Tier 1" />
              </label>
            </div>
            <div className="dash-grid-1-1" style={{ gap: '12px' }}>
              <label className="flex-between" style={{ padding: '12px', border: '1px solid var(--border)', background: 'var(--bg)' }}>
                <span className="font-600 text-12">Auto elevate</span>
                <input type="checkbox" checked={settings.autoElevate} onChange={(event) => setSettings({ ...settings, autoElevate: event.target.checked })} style={{ width: '18px', height: '18px' }} />
              </label>
              <label className="flex-between" style={{ padding: '12px', border: '1px solid var(--border)', background: 'var(--bg)' }}>
                <span className="font-600 text-12">Auto remove dead</span>
                <input type="checkbox" checked={settings.autoRemoveDead} onChange={(event) => setSettings({ ...settings, autoRemoveDead: event.target.checked })} style={{ width: '18px', height: '18px' }} />
              </label>
            </div>
          </div>
        </div>

        <div className="dash-card mb-0">
          <div className="dash-card-title flex-between">
            <span>Provider Toggles</span>
            <SlidersHorizontal size={14} className="text-accent" />
          </div>
          <div className="dash-stack">
            <div className="dash-param" style={{ border: '1px solid var(--border-bright)' }}>
              <div className="dash-param-label">Enabled Providers</div>
              <div className="dash-param-value">{activeProviders} / {Object.keys(settings.providers).length}</div>
            </div>
            {Object.entries(settings.providers).map(([provider, enabled]) => (
              <label key={provider} className="flex-between" style={{ padding: '12px', border: '1px solid var(--border)', background: 'var(--bg)' }}>
                <span className="font-600 text-12">{provider}</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setSettings({ ...settings, providers: { ...settings.providers, [provider]: event.target.checked } })}
                  style={{ width: '18px', height: '18px' }}
                />
              </label>
            ))}
            <button
              type="button"
              className="btn-primary inline-flex items-center justify-center gap-6"
              onClick={() => void saveSettings()}
              disabled={saveState === 'pending'}
              title="Persist proxy settings to the owning service"
              style={{ padding: '12px' }}
            >
              <ShieldCheck size={14} />
              Save Proxy Settings
            </button>
            {saveMessage && (
              <div className="text-12" style={{ color: saveState === 'error' ? '#ef4444' : 'var(--accent)' }}>
                {saveMessage}
              </div>
            )}
            <div className="text-10 text-muted mono mt-4">
              Live source: <span className={`badge ${sourceBadge(source)}`}>{sourceLabel(source)}</span>
              <Database size={10} className="text-accent" style={{ marginLeft: '6px', verticalAlign: 'middle' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Ban,
  ChevronRight,
  Download,
  LogIn,
  Mail,
  KeyRound,
  LockKeyhole,
  PencilLine,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';

type Range = '7d' | '30d' | '90d';
type Scope = 'all' | 'locked' | 'unverified' | 'keyless' | 'notes' | 'highUsage';

interface Plan {
  id: string;
  name: string;
  priceCents: number;
  requestsPerDay: number;
  requestsPerMinute: number;
  requestsPerMonth: number;
  allowedModels: string;
}

interface UserListItem {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  isLocked: boolean;
  isShadowLocked: boolean;
  isShadowBanned: boolean;
  adminNote: string | null;
  plan: Plan;
  createdAt: string;
  updatedAt: string;
  apiKeys: { id: string; name: string; lastFour: string | null; isActive: boolean; createdAt: string }[];
  payments: { id: string; amountCents: number; status: string; createdAt: string }[];
  usage: {
    totalTokens: number;
    totalRequests: number;
    totalCost: number;
    promptTokens: number;
    completionTokens: number;
    topModels: { model: string; requests: number }[];
  };
  totalPaidCents: number;
}

interface Summary {
  totalUsers: number;
  verifiedUsers: number;
  totalApiKeys: number;
  activeApiKeys: number;
  totalRevenueCents: number;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  platformTotalRequests?: number;
  platformTotalTokens?: number;
  platformTotalCost?: number;
  matchedRequests?: number;
  matchedTokens?: number;
  matchedCost?: number;
  unmatchedRequests?: number;
  unmatchedTokens?: number;
  unmatchedCost?: number;
  coveragePct?: number;
  planBreakdown: { id: string; name: string; priceCents: number; userCount: number }[];
}

interface TrendPoint {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
}

interface ModelUsage {
  model: string;
  requests: number;
}

interface AdminAnalyticsData {
  summary: Summary;
  users: UserListItem[];
  globalAnalytics: { dailyTrend: TrendPoint[]; byModel: ModelUsage[] };
  range: string;
}

interface SavedView {
  name: string;
  scope: Scope;
  search: string;
  sortBy: 'recent' | 'requests' | 'tokens' | 'paid' | 'status';
  range: Range;
}

interface AuditLogItem {
  id: string;
  action: string;
  actor: string;
  targetUserId: string | null;
  targetUserEmail: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

interface UserDetail {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  isLocked: boolean;
  isShadowLocked: boolean;
  isShadowBanned: boolean;
  adminNote: string | null;
  stripeCustomerId: string | null;
  plan: Plan;
  createdAt: string;
  updatedAt: string;
  apiKeys: { id: string; name: string; lastFour: string | null; isActive: boolean; createdAt: string }[];
  payments: { id: string; amountCents: number; planId: string | null; status: string; createdAt: string }[];
  usage: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    promptTokens: number;
    completionTokens: number;
    topModels: { model: string; requests: number }[];
    matchedRequests?: number;
    unmatchedRequests?: number;
    coveragePct?: number;
  };
  totalPaidCents: number;
  recentAudit: AuditLogItem[];
  range: string;
}

const RANGE_OPTIONS: Range[] = ['7d', '30d', '90d'];

function fmt(n: number) {
  return n.toLocaleString();
}

function fmtUSD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function timeAgo(value: string, now: number) {
  const seconds = Math.floor((now - new Date(value).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function actionLabel(action: string) {
  switch (action) {
    case 'user.locked':
      return 'Locked';
    case 'user.unlocked':
      return 'Unlocked';
    case 'user.plan_changed':
      return 'Plan changed';
    case 'user.keys_revoked':
      return 'Keys revoked';
    case 'user.note_updated':
      return 'Note updated';
    case 'support.ticket_created':
      return 'Ticket created';
    case 'support.ticket_updated':
      return 'Ticket updated';
    case 'user.deleted':
      return 'Deleted';
    default:
      return action;
  }
}

export default function AdminAccountsDashboard() {
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<Range>('30d');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'requests' | 'tokens' | 'paid' | 'status'>('recent');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkPlanDraft, setBulkPlanDraft] = useState<string>('free');
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [planDraft, setPlanDraft] = useState<string>('free');
  const [importStatus, setImportStatus] = useState('');
  const [now] = useState(() => Date.now());
  const bulkSelectRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [shadowbanRuleEnabled, setShadowbanRuleEnabled] = useState(false);
  const [shadowbanRuleLoading, setShadowbanRuleLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem('admin-account-views');
        if (raw) {
          setSavedViews(JSON.parse(raw) as SavedView[]);
        }
      } catch {
        // ignore storage errors
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch('/api/admin/settings')
        .then(r => r.ok ? r.json() : null)
        .then((json: { config?: { emailDotShadowban?: { enabled?: boolean } } } | null) => {
          if (json?.config?.emailDotShadowban) {
            setShadowbanRuleEnabled(json.config.emailDotShadowban.enabled === true);
          }
        })
        .catch(() => {});
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function toggleShadowbanRule() {
    setShadowbanRuleLoading(true);
    const next = !shadowbanRuleEnabled;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailDotShadowban: { enabled: next }, actor: 'admin' }),
      });
      if (res.ok) {
        setShadowbanRuleEnabled(next);
      }
    } catch {
      // ignore
    } finally {
      setShadowbanRuleLoading(false);
    }
  }

  useEffect(() => {
    try {
      window.localStorage.setItem('admin-account-views', JSON.stringify(savedViews));
    } catch {
      // ignore storage errors
    }
  }, [savedViews]);

  const fetchOverview = useCallback(async (selectedRange: Range = range) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?range=${selectedRange}`);
      if (!res.ok) {
        setError('Failed to load dashboard');
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

  const fetchUserDetail = useCallback(async (userId: string, selectedRange: Range = range) => {
    setDetailLoading(true);
    setDetailError('');
    try {
      const res = await fetch(`/api/admin/users/${userId}?range=${selectedRange}`);
      if (!res.ok) {
        setDetailError('Failed to load user');
        return;
      }
      const json = await res.json() as { user: UserDetail };
      setSelectedUser(json.user);
      setNoteDraft(json.user.adminNote || '');
      setPlanDraft(json.user.plan.id);
    } catch {
      setDetailError('Network error');
    } finally {
      setDetailLoading(false);
    }
  }, [range]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchOverview(range);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchOverview, range]);

  useEffect(() => {
    if (!selectedUserId) return;
    const timer = window.setTimeout(() => {
      void fetchUserDetail(selectedUserId, range);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedUserId, range, fetchUserDetail]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const users = data?.users || [];
    return [...users]
      .filter((user) => {
        if (scope === 'locked' && !user.isLocked) return false;
        if (scope === 'unverified' && user.emailVerified) return false;
        if (scope === 'keyless' && user.apiKeys.length > 0) return false;
        if (scope === 'notes' && !user.adminNote) return false;
        if (scope === 'highUsage' && user.usage.totalRequests < 100) return false;
        if (!q) return true;
        return (
          user.email.toLowerCase().includes(q) ||
          user.name?.toLowerCase().includes(q) ||
          user.plan.name.toLowerCase().includes(q) ||
          (user.adminNote || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'requests') return b.usage.totalRequests - a.usage.totalRequests;
        if (sortBy === 'tokens') return b.usage.totalTokens - a.usage.totalTokens;
        if (sortBy === 'paid') return b.totalPaidCents - a.totalPaidCents;
        if (sortBy === 'status') {
          return Number(a.isLocked) - Number(b.isLocked) || Number(a.emailVerified) - Number(b.emailVerified);
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [data, search, scope, sortBy]);

  const visibleSelectedIds = useMemo(
    () => filteredUsers.filter((user) => selectedIds.includes(user.id)).map((user) => user.id),
    [filteredUsers, selectedIds]
  );
  const allVisibleSelected = filteredUsers.length > 0 && visibleSelectedIds.length === filteredUsers.length;
  const partiallyVisibleSelected = visibleSelectedIds.length > 0 && !allVisibleSelected;

  useEffect(() => {
    if (bulkSelectRef.current) {
      bulkSelectRef.current.indeterminate = partiallyVisibleSelected;
    }
  }, [partiallyVisibleSelected]);

  const topModels = data?.globalAnalytics.byModel.slice(0, 6) || [];
  const totalLockedUsers = data?.users.filter((user) => user.isLocked).length || 0;
  const noteCount = data?.users.filter((user) => !!user.adminNote).length || 0;
  const totalPayingAccounts = data?.users.filter((user) => user.totalPaidCents > 0).length || 0;
  const attentionUsers = (data?.users || []).filter((user) => !user.emailVerified || user.isLocked || !user.apiKeys.length).slice(0, 6);

  async function runUserAction(userId: string, action: string, payload: Record<string, unknown> = {}) {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: action === 'delete' ? undefined : JSON.stringify({ action, ...payload }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setDetailError(json?.error || 'Failed to update account');
        return null;
      }
      const json = await res.json().catch(() => null);
      await fetchOverview(range);
      await fetchUserDetail(userId, range);
      return json;
    } catch {
      setDetailError('Network error');
      return null;
    } finally {
      setActionLoading(null);
    }
  }

  async function submitAction(action: string, payload: Record<string, unknown> = {}) {
    if (!selectedUserId) return;
    return runUserAction(selectedUserId, action, payload);
  }

  async function submitBulkAction(action: string, payload: Record<string, unknown> = {}) {
    if (!selectedIds.length) return;
    await Promise.all(selectedIds.map((userId) => runUserAction(userId, action, payload)));
    setSelectedIds([]);
  }

  function toggleSelection(userId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(userId) ? current : [...current, userId];
      }
      return current.filter((id) => id !== userId);
    });
  }

  function saveCurrentView() {
    const name = window.prompt('Name this view');
    if (!name?.trim()) return;
    setSavedViews((current) => {
      const next = current.filter((view) => view.name !== name.trim()).concat({
        name: name.trim(),
        scope,
        search,
        sortBy,
        range,
      });
      return next.slice(-12);
    });
  }

  function applySavedView(view: SavedView) {
    setScope(view.scope);
    setSearch(view.search);
    setSortBy(view.sortBy);
    setRange(view.range);
  }

  function exportFilteredCsv() {
    const targetUsers = selectedIds.length > 0
      ? filteredUsers.filter((user) => selectedIds.includes(user.id))
      : filteredUsers;
    const header = [
      'email',
      'name',
      'plan_id',
      'plan_name',
      'status',
      'verified',
      'locked',
      'keys',
      'requests',
      'tokens',
      'paid_cents',
      'note',
      'created_at',
    ];
    const rows = targetUsers.map((user) => [
      user.email,
      user.name || '',
      user.plan.id,
      user.plan.name,
      user.isLocked ? 'locked' : 'active',
      user.emailVerified ? 'yes' : 'no',
      user.isLocked ? 'yes' : 'no',
      user.apiKeys.length,
      user.usage.totalRequests,
      user.usage.totalTokens,
      user.totalPaidCents,
      user.adminNote || '',
      user.createdAt,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/\r?\n/g, ' ').replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `accounts-${selectedIds.length > 0 ? 'selected' : 'filtered'}-${range}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function parseCsvRows(text: string) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) return [];
    const parseLine = (line: string) => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        const next = line[i + 1];
        if (char === '"' && inQuotes && next === '"') {
          current += '"';
          i += 1;
          continue;
        }
        if (char === '"') {
          inQuotes = !inQuotes;
          continue;
        }
        if (char === ',' && !inQuotes) {
          values.push(current);
          current = '';
          continue;
        }
        current += char;
      }
      values.push(current);
      return values.map((value) => value.trim());
    };
    const headers = parseLine(lines[0]).map((header) => header.toLowerCase());
    return lines.slice(1).map((line) => {
      const values = parseLine(line);
      return headers.reduce<Record<string, string>>((acc, header, index) => {
        acc[header] = values[index] || '';
        return acc;
      }, {});
    });
  }

  async function importCsvFile(file: File) {
    setImportStatus('Parsing CSV...');
    const text = await file.text();
    const rows = parseCsvRows(text).map((row) => ({
      email: row.email,
      name: row.name || null,
      planId: row.plan_id || row.planid || row.plan || 'free',
      emailVerified: row.verified === 'yes' || row.verified === 'true',
      isLocked: row.locked === 'yes' || row.locked === 'true',
      adminNote: row.note || null,
    })).filter((row) => row.email);

    if (!rows.length) {
      setImportStatus('No usable rows found.');
      return;
    }

    setImportStatus(`Importing ${rows.length} accounts...`);
    try {
      const res = await fetch('/api/admin/accounts/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) {
        setImportStatus('Import failed.');
        return;
      }
      const json = await res.json() as { created?: number; updated?: number };
      setImportStatus(`Imported ${json.created || 0} created, ${json.updated || 0} updated.`);
      await fetchOverview(range);
    } catch {
      setImportStatus('Import failed.');
    }
  }

  if (error && !data && !loading) {
    return (
      <div style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '24px', textAlign: 'center', fontFamily: 'Space Mono, monospace' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Accounts failed to load</h2>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>{error}</p>
          <button type="button" onClick={() => void fetchOverview(range)} className="btn-border" style={{ padding: '6px 12px' }}>
            Retry Operations
          </button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="auth-spinner" />
      </div>
    );
  }

  const summary = data.summary;
  const openUser = selectedUser || null;
  const openUserShell = selectedUser || (selectedUserId ? data.users.find((user) => user.id === selectedUserId) || null : null);

  return (
    <div>
      {/* Header */}
      <div className="dash-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 className="dash-page-title">Accounts Management</h1>
          <p className="dash-page-sub">
            Review user details, plan limits, API keys, lock controls, and system logs.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => setRange(option)}
              className="btn-border"
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                fontFamily: 'Space Mono, monospace',
                background: range === option ? 'var(--accent)' : 'transparent',
                color: range === option ? 'var(--bg)' : 'var(--text)',
                borderColor: range === option ? 'var(--accent)' : 'var(--border-bright)'
              }}
            >
              {option.toUpperCase()}
            </button>
          ))}
          <button
            onClick={() => void fetchOverview(range)}
            className="btn-border"
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontFamily: 'Space Mono, monospace',
              background: 'transparent',
              color: 'var(--text)',
              borderColor: 'var(--border-bright)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {/* Auto-Shadowban Rule Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', border: '1px solid var(--border-bright)', padding: '16px', background: 'var(--surface)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-accent">Anti-Spam Filter</span>
            <strong style={{ fontSize: '13px' }}>Auto-Shadowban: Gmail Dot Rule</strong>
            <span className={`badge ${shadowbanRuleEnabled ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '8px' }}>
              {shadowbanRuleEnabled ? 'ACTIVE' : 'DISABLED'}
            </span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>
            Gmail registrations with 4+ dots in the username are automatically shadow-banned on registration.
          </p>
        </div>
        <button
          id="shadowban-rule-toggle"
          type="button"
          disabled={shadowbanRuleLoading}
          onClick={() => void toggleShadowbanRule()}
          className="btn-border"
          style={{
            padding: '6px 12px',
            fontSize: '11px',
            fontFamily: 'Space Mono, monospace',
            background: shadowbanRuleEnabled ? 'var(--accent)' : 'transparent',
            color: shadowbanRuleEnabled ? 'var(--bg)' : 'var(--text)',
            borderColor: shadowbanRuleEnabled ? 'var(--accent)' : 'var(--border-bright)'
          }}
        >
          {shadowbanRuleEnabled ? 'Disable filter' : 'Enable filter'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="dash-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '24px' }}>
        {[
          { label: 'Total Users', value: fmt(summary.totalUsers), sub: `${fmt(summary.verifiedUsers)} verified`, color: 'var(--text)' },
          { label: 'Paid Accounts', value: fmtUSD(summary.totalRevenueCents), sub: `${fmt(totalPayingAccounts)} paying`, color: 'var(--accent)' },
          {
            label: 'Total Requests',
            value: fmtTokens(summary.totalRequests),
            sub:
              typeof summary.matchedRequests === 'number'
                ? `${fmt(summary.matchedRequests)} matched reqs`
                : `range: ${data.range.toUpperCase()}`,
            color: 'var(--text)',
          },
          {
            label: 'Total Tokens',
            value: fmtTokens(summary.totalTokens),
            sub: `$${summary.totalCost.toFixed(2)} est. cost`,
            color: 'var(--muted)',
          },
          { label: 'API Keys', value: fmt(summary.totalApiKeys), sub: `${fmt(summary.activeApiKeys)} active`, color: 'var(--muted)' },
          { label: 'Locked Users', value: fmt(totalLockedUsers), sub: 'held accounts', color: 'var(--accent)' },
          { label: 'Note Flags', value: fmt(noteCount), sub: 'annotated accounts', color: 'var(--muted)' },
          { label: 'Total Coverage', value: typeof summary.coveragePct === 'number' ? `${summary.coveragePct}%` : 'n/a', sub: 'analytics coverage', color: 'var(--accent)' },
        ].map((card) => (
          <div key={card.label} className="dash-stat">
            <div className="dash-stat-label">
              <span>{card.label}</span>
              <span style={{ color: card.color }}>●</span>
            </div>
            <div className="dash-stat-value">{card.value}</div>
            <div className="dash-stat-sub">{card.sub}</div>
          </div>
        ))}
      </div>

      {typeof summary.unmatchedRequests === 'number' && summary.unmatchedRequests > 0 && (
        <div style={{
          border: '1px solid #f59e0b',
          background: 'rgba(245, 158, 11, 0.05)',
          padding: '16px',
          marginBottom: '24px',
          fontSize: '12px',
          fontFamily: 'Space Mono, monospace',
          color: '#f59e0b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <strong>ANALYTICS GAP:</strong> {fmt(summary.unmatchedRequests)} requests & {fmtTokens(summary.unmatchedTokens || 0)} tokens are not linked to accounts.
          </div>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Coverage: {summary.coveragePct}%
          </div>
        </div>
      )}

      {/* Main Command Split Layout */}
      <div className="dash-grid-2" style={{ marginBottom: '24px' }}>
        <div className="dash-card" style={{ marginBottom: 0, overflowX: 'auto' }}>
          <div className="dash-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border-bright)', paddingBottom: '16px', marginBottom: '20px' }}>
            <span>Platform Customer Directory</span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--muted)' }} />
                <input
                  type="text"
                  className="input-field"
                  style={{ padding: '6px 12px 6px 30px', fontSize: '11px', width: '200px', fontFamily: 'Space Mono, monospace' }}
                  placeholder="Filter accounts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="input-field"
                style={{ padding: '6px 12px', fontSize: '11px', width: '130px', fontFamily: 'Space Mono, monospace', appearance: 'auto', background: 'var(--bg)' }}
              >
                <option value="recent">Newest First</option>
                <option value="requests">Most Requests</option>
                <option value="tokens">Most Tokens</option>
                <option value="paid">Highest Paid</option>
                <option value="status">Status Priority</option>
              </select>
            </div>
          </div>

          {/* Scopes filters & action shortcuts */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(['all', 'locked', 'unverified', 'keyless', 'notes', 'highUsage'] as Scope[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setScope(item)}
                  className="btn-border"
                  style={{
                    padding: '4px 10px',
                    fontSize: '10px',
                    fontFamily: 'Space Mono, monospace',
                    background: scope === item ? 'var(--accent)' : 'transparent',
                    color: scope === item ? 'var(--bg)' : 'var(--text)',
                    borderColor: scope === item ? 'var(--accent)' : 'var(--border-bright)'
                  }}
                >
                  {item === 'all' ? 'All' : item === 'highUsage' ? 'High Usage' : item.charAt(0).toUpperCase() + item.slice(1)}
                </button>
              ))}
              <button type="button" onClick={saveCurrentView} className="btn-border" style={{ padding: '4px 10px', fontSize: '10px', fontFamily: 'Space Mono, monospace' }}>
                Save view
              </button>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" onClick={exportFilteredCsv} className="btn-border" style={{ padding: '4px 10px', fontSize: '10px', fontFamily: 'Space Mono, monospace' }}>
                Export CSV
              </button>
              <button type="button" onClick={() => importInputRef.current?.click()} className="btn-border" style={{ padding: '4px 10px', fontSize: '10px', fontFamily: 'Space Mono, monospace' }}>
                Import CSV
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void importCsvFile(file);
                  }
                  e.currentTarget.value = '';
                }}
              />
            </div>
          </div>

          {importStatus && (
            <div style={{ padding: '8px 12px', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '11px', fontFamily: 'Space Mono, monospace', marginBottom: '16px' }}>
              Import status: {importStatus}
            </div>
          )}

          {/* Saved view chips */}
          {savedViews.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', borderTop: '1px dashed var(--border)', paddingTop: '12px' }}>
              <span style={{ fontSize: '9px', fontFamily: 'Space Mono, monospace', color: 'var(--muted)', uppercase: 'true' } as any}>Saved Views:</span>
              {savedViews.map((view) => (
                <button
                  key={view.name}
                  type="button"
                  onClick={() => applySavedView(view)}
                  className="badge badge-accent"
                  style={{ cursor: 'pointer', border: '1px solid var(--accent)', padding: '2px 8px', fontSize: '10px' }}
                >
                  {view.name}
                </button>
              ))}
            </div>
          )}

          {/* Bulk actions options bar */}
          {selectedIds.length > 0 && (
            <div style={{ border: '1px solid var(--border-bright)', background: 'var(--surface)', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>{selectedIds.length} accounts selected</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  className="input-field"
                  value={bulkPlanDraft}
                  onChange={(e) => setBulkPlanDraft(e.target.value)}
                  style={{ padding: '4px 10px', fontSize: '11px', width: '110px', fontFamily: 'Space Mono, monospace', appearance: 'auto', background: 'var(--bg)' }}
                >
                  {summary.planBreakdown.map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </select>
                <button className="btn-border" style={{ padding: '4px 10px', fontSize: '10px', fontFamily: 'Space Mono, monospace' }} onClick={() => void submitBulkAction('lock')}>Lock</button>
                <button className="btn-border" style={{ padding: '4px 10px', fontSize: '10px', fontFamily: 'Space Mono, monospace' }} onClick={() => void submitBulkAction('unlock')}>Unlock</button>
                <button className="btn-border" style={{ padding: '4px 10px', fontSize: '10px', fontFamily: 'Space Mono, monospace' }} onClick={() => void submitBulkAction('revokeKeys')}>Revoke Keys</button>
                <button className="btn-border" style={{ padding: '4px 10px', fontSize: '10px', fontFamily: 'Space Mono, monospace', background: 'var(--accent)', color: 'var(--bg)', borderColor: 'var(--accent)' }} onClick={() => void submitBulkAction('plan', { planId: bulkPlanDraft })}>Apply Plan</button>
                <button className="btn-border" style={{ padding: '4px 10px', fontSize: '10px', fontFamily: 'Space Mono, monospace' }} onClick={() => setSelectedIds([])}>Clear</button>
              </div>
            </div>
          )}

          {/* Directory table */}
          <table className="dash-table">
            <thead>
              <tr>
                <th style={{ width: '40px', paddingLeft: '16px' }}>
                  <input
                    ref={bulkSelectRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => setSelectedIds(e.target.checked ? filteredUsers.map((user) => user.id) : [])}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th>User Account</th>
                <th>Plan</th>
                <th>Joined</th>
                <th style={{ textAlign: 'right' }}>Requests</th>
                <th style={{ textAlign: 'right' }}>Keys</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const isSelected = selectedUserId === user.id;
                return (
                  <tr
                    key={user.id}
                    className={isSelected ? 'active' : ''}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedUser(null);
                      setDetailError('');
                      setSelectedUserId(user.id);
                    }}
                  >
                    <td style={{ paddingLeft: '16px' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(user.id)}
                        onChange={(e) => toggleSelection(user.id, e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="dash-avatar" style={{ width: '24px', height: '24px', fontSize: '10px' }}>
                          {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{user.name || '—'}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${user.plan.id === 'free' ? 'badge-warning' : user.plan.id === 'pro' ? 'badge-accent' : 'badge-success'}`}>
                        {user.plan.name}
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: '11px', fontFamily: 'Space Mono, monospace' }}>
                      {timeAgo(user.createdAt, now)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'Space Mono, monospace' }}>{fmt(user.usage.totalRequests)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'Space Mono, monospace' }}>{user.apiKeys.length}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'Space Mono, monospace', color: user.totalPaidCents > 0 ? 'var(--accent)' : 'var(--muted)' }}>
                      {user.totalPaidCents > 0 ? fmtUSD(user.totalPaidCents) : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                        {user.isLocked ? (
                          <span className="badge badge-danger">locked</span>
                        ) : user.emailVerified ? (
                          <span className="badge badge-success">verified</span>
                        ) : (
                          <span className="badge badge-warning">pending</span>
                        )}
                        {user.isShadowBanned && <span className="badge badge-danger" style={{ fontSize: '8px', padding: '1px 4px' }}>sbanned</span>}
                        {user.isShadowLocked && <span className="badge badge-warning" style={{ fontSize: '8px', padding: '1px 4px' }}>slocked</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {user.adminNote ? <span className="badge badge-accent">note</span> : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--muted)' }}>
                      <ChevronRight size={14} style={{ transform: isSelected ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Attention Queue */}
          <div className="dash-card" style={{ marginBottom: 0 }}>
            <div className="dash-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Attention Queue</span>
              <span className="badge badge-accent">{attentionUsers.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {attentionUsers.length > 0 ? attentionUsers.map((user) => (
                <button
                  key={user.id}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '12px', display: 'block', width: '100%', cursor: 'pointer', textAlign: 'left' }}
                  onClick={() => {
                    setSelectedUser(null);
                    setDetailError('');
                    setSelectedUserId(user.id);
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name || user.email}</div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                        {user.isLocked ? 'Locked' : user.emailVerified ? 'Verified' : 'Unverified'} · {user.apiKeys.length} keys · {fmt(user.usage.totalRequests)} reqs
                      </div>
                    </div>
                    <span className="badge badge-warning" style={{ fontSize: '8px' }}>Review</span>
                  </div>
                </button>
              )) : (
                <div style={{ color: 'var(--muted)', fontSize: '11px', fontFamily: 'Space Mono, monospace' }}>No attention signals flagged.</div>
              )}
            </div>
          </div>

          {/* Top Models */}
          <div className="dash-card" style={{ marginBottom: 0 }}>
            <div className="dash-card-title">Top Models Mix</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {topModels.map((model, index) => (
                <div key={model.model} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: index === 0 ? 'var(--accent-dim)' : 'var(--surface)', border: index === 0 ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'Space Mono, monospace' }}>{index + 1}.</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, fontFamily: 'Space Mono, monospace' }}>{model.model}</span>
                  </div>
                  <span style={{ fontSize: '11px', fontFamily: 'Space Mono, monospace', color: 'var(--muted)' }}>{fmt(model.requests || 0)} reqs</span>
                </div>
              ))}
            </div>
          </div>

          {/* Plan Breakdown distribution */}
          <div className="dash-card" style={{ marginBottom: 0 }}>
            <div className="dash-card-title">Plan breakdown shares</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {summary.planBreakdown.map((plan) => {
                const share = summary.totalUsers > 0 ? (plan.userCount / summary.totalUsers) * 100 : 0;
                return (
                  <div key={plan.id} style={{ border: '1px solid var(--border)', padding: '12px', background: 'var(--surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '12px' }}>{plan.name}</span>
                      <span style={{ color: 'var(--muted)', fontSize: '11px', fontFamily: 'Space Mono, monospace' }}>{plan.userCount} users</span>
                    </div>
                    <div style={{ height: '4px', background: 'var(--border-bright)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'var(--accent)', width: `${Math.max(share, 4)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Slide-out user detail drawer */}
      {selectedUserId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}
            onClick={() => {
              setSelectedUserId(null);
              setSelectedUser(null);
              setDetailError('');
            }}
          />
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '680px',
              height: '100%',
              background: 'var(--bg)',
              borderLeft: '1px solid var(--border-bright)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              padding: '24px',
              zIndex: 60
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-bright)', paddingBottom: '16px', marginBottom: '24px' }}>
              <div>
                <div className="badge badge-accent" style={{ marginBottom: '8px' }}>Customer File</div>
                <h3 style={{ fontSize: '20px', fontWeight: 700 }}>{openUserShell?.name || openUserShell?.email || 'Loading Account...'}</h3>
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>{openUserShell?.email || 'Fetching profile parameters…'}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedUserId(null);
                  setSelectedUser(null);
                  setDetailError('');
                }}
                className="btn-border"
                style={{ padding: '6px 12px', fontFamily: 'Space Mono, monospace', fontSize: '11px' }}
              >
                Close ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {detailError && (
                <div style={{ padding: '12px', border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', fontSize: '12px', fontFamily: 'Space Mono, monospace' }}>
                  {detailError}
                </div>
              )}

              {detailLoading ? (
                <div style={{ py: '40px', display: 'flex', justifyContent: 'center' } as any}>
                  <div className="auth-spinner" />
                </div>
              ) : !openUser ? (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px' }}>
                  Unable to parse customer details.
                </div>
              ) : (
                <>
                  {/* Stats telemetry */}
                  <div className="dash-stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 0 }}>
                    <div className="dash-stat">
                      <div className="dash-stat-label">Requests</div>
                      <div className="dash-stat-value" style={{ fontSize: '18px' }}>{fmt(openUser.usage.totalRequests)}</div>
                    </div>
                    <div className="dash-stat">
                      <div className="dash-stat-label">Tokens</div>
                      <div className="dash-stat-value" style={{ fontSize: '18px' }}>{fmtTokens(openUser.usage.totalTokens)}</div>
                    </div>
                    <div className="dash-stat">
                      <div className="dash-stat-label">Spend</div>
                      <div className="dash-stat-value" style={{ fontSize: '18px' }}>{fmtUSD(Math.round(openUser.usage.totalCost * 100))}</div>
                    </div>
                    <div className="dash-stat">
                      <div className="dash-stat-label">Paid</div>
                      <div className="dash-stat-value" style={{ fontSize: '18px' }}>{openUser.totalPaidCents > 0 ? fmtUSD(openUser.totalPaidCents) : '—'}</div>
                    </div>
                  </div>

                  <div className="dash-grid-2">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* State profile */}
                      <div className="dash-card" style={{ marginBottom: 0 }}>
                        <div className="dash-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                          <span>Profile limits & status</span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {openUser.isLocked ? <span className="badge badge-danger">locked</span> : <span className="badge badge-success">active</span>}
                            {openUser.emailVerified ? <span className="badge badge-success">verified</span> : <span className="badge badge-warning">pending</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                            <span style={{ color: 'var(--muted)' }}>Plan Tier</span>
                            <span style={{ fontWeight: 600 }}>{openUser.plan.name}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                            <span style={{ color: 'var(--muted)' }}>Joined Date</span>
                            <span style={{ fontWeight: 600 }}>{new Date(openUser.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                            <span style={{ color: 'var(--muted)' }}>Active API Keys</span>
                            <span style={{ fontWeight: 600 }}>{openUser.apiKeys.length}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--muted)' }}>Stripe Ref ID</span>
                            <span style={{ fontWeight: 600, fontSize: '10px', fontFamily: 'Space Mono, monospace' }}>{openUser.stripeCustomerId || '—'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Internal note form */}
                      <div className="dash-card" style={{ marginBottom: 0 }}>
                        <div className="dash-card-title">Staff Audit Note</div>
                        <textarea
                          className="input-field"
                          style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
                          placeholder="Leave admin notes..."
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Visible to operators only.</span>
                          <button
                            className="btn-border"
                            style={{ padding: '6px 12px', background: 'var(--accent)', color: 'var(--bg)', borderColor: 'var(--accent)', fontSize: '11px', fontFamily: 'Space Mono, monospace' }}
                            onClick={() => void submitAction('note', { note: noteDraft })}
                            disabled={actionLoading === 'note'}
                          >
                            {actionLoading === 'note' ? 'Saving...' : 'Save Note'}
                          </button>
                        </div>
                      </div>

                      {/* Plan draft config */}
                      <div className="dash-card" style={{ marginBottom: 0 }}>
                        <div className="dash-card-title">Modify Billing Plan</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <select
                            className="input-field"
                            value={planDraft}
                            onChange={(e) => setPlanDraft(e.target.value)}
                            style={{ flex: 1, padding: '6px 12px', fontSize: '11px', fontFamily: 'Space Mono, monospace', appearance: 'auto', background: 'var(--bg)' }}
                          >
                            {summary.planBreakdown.map((plan) => (
                              <option key={plan.id} value={plan.id}>{plan.name}</option>
                            ))}
                          </select>
                          <button
                            className="btn-border"
                            style={{ padding: '6px 12px', fontSize: '11px', fontFamily: 'Space Mono, monospace' }}
                            onClick={() => void submitAction('plan', { planId: planDraft })}
                            disabled={actionLoading === 'plan'}
                          >
                            {actionLoading === 'plan' ? 'Saving...' : 'Apply Plan'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Operations buttons list */}
                      <div className="dash-card" style={{ marginBottom: 0 }}>
                        <div className="dash-card-title">Administrative Actions</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <button
                            className="btn-border"
                            style={{ width: '100%', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'Space Mono, monospace' }}
                            onClick={() => void (async () => {
                              const result = await submitAction('impersonate');
                              const url = result && typeof result === 'object' ? (result.url as string | undefined) : undefined;
                              if (url) {
                                window.location.assign(url);
                              }
                            })()}
                            disabled={actionLoading === 'impersonate'}
                          >
                            <span>Impersonate customer</span>
                            <span style={{ color: 'var(--muted)', fontSize: '9px' }}>SUPPORT</span>
                          </button>

                          <button
                            className="btn-border"
                            style={{ width: '100%', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'Space Mono, monospace' }}
                            onClick={() => void submitAction('resendVerification')}
                            disabled={actionLoading === 'resendVerification' || openUser.emailVerified}
                          >
                            <span>Resend verification email</span>
                            <span style={{ color: 'var(--muted)', fontSize: '9px' }}>SUPPORT</span>
                          </button>

                          <button
                            className="btn-border"
                            style={{ width: '100%', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'Space Mono, monospace' }}
                            onClick={() => void submitAction('resetPassword')}
                            disabled={actionLoading === 'resetPassword'}
                          >
                            <span>Send password reset</span>
                            <span style={{ color: 'var(--muted)', fontSize: '9px' }}>SUPPORT</span>
                          </button>

                          <button
                            className="btn-border"
                            style={{ width: '100%', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'Space Mono, monospace' }}
                            onClick={() => void submitAction(openUser.isLocked ? 'unlock' : 'lock', { note: noteDraft })}
                            disabled={actionLoading === 'lock' || actionLoading === 'unlock'}
                          >
                            <span>{openUser.isLocked ? 'Unlock access' : 'Lock access'}</span>
                            <span style={{ color: 'var(--muted)', fontSize: '9px' }}>ACCESS</span>
                          </button>

                          <button
                            className="btn-border"
                            style={{ width: '100%', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'Space Mono, monospace' }}
                            onClick={() => void submitAction('shadowBan', { active: !openUser.isShadowBanned })}
                            disabled={actionLoading === 'shadowBan'}
                          >
                            <span style={{ color: openUser.isShadowBanned ? '#10b981' : '#ef4444' }}>
                              {openUser.isShadowBanned ? 'Remove shadowban' : 'Shadowban user'}
                            </span>
                            <span style={{ color: 'var(--muted)', fontSize: '9px' }}>ACCESS</span>
                          </button>

                          <button
                            className="btn-border"
                            style={{ width: '100%', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'Space Mono, monospace' }}
                            onClick={() => void submitAction('shadowLock', { active: !openUser.isShadowLocked })}
                            disabled={actionLoading === 'shadowLock'}
                          >
                            <span style={{ color: openUser.isShadowLocked ? '#10b981' : '#f59e0b' }}>
                              {openUser.isShadowLocked ? 'Remove shadowlock' : 'Shadowlock user'}
                            </span>
                            <span style={{ color: 'var(--muted)', fontSize: '9px' }}>ACCESS</span>
                          </button>

                          <button
                            className="btn-border"
                            style={{ width: '100%', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'Space Mono, monospace' }}
                            onClick={() => void submitAction('revokeKeys')}
                            disabled={actionLoading === 'revokeKeys'}
                          >
                            <span>Revoke all API keys</span>
                            <span style={{ color: 'var(--muted)', fontSize: '9px' }}>API KEYS</span>
                          </button>

                          <button
                            className="btn-border"
                            style={{ width: '100%', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'Space Mono, monospace' }}
                            onClick={() => void submitAction('delete')}
                            disabled={actionLoading === 'delete'}
                          >
                            <span style={{ color: '#ef4444' }}>Soft delete profile</span>
                            <span style={{ color: 'var(--muted)', fontSize: '9px' }}>DANGER</span>
                          </button>
                        </div>
                      </div>

                      {/* API Keys list */}
                      <div className="dash-card" style={{ marginBottom: 0 }}>
                        <div className="dash-card-title">Customer Keys</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {openUser.apiKeys.length > 0 ? openUser.apiKeys.map((key) => (
                            <div key={key.id} style={{ border: '1px solid var(--border)', padding: '10px', background: 'var(--surface)', fontSize: '11px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontWeight: 600 }}>{key.name}</div>
                                  <div style={{ color: 'var(--muted)', marginTop: '2px' }}>
                                    {key.lastFour ? `•••• ${key.lastFour}` : '••••'} · {new Date(key.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                                <span className={`badge ${key.isActive ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '8px' }}>
                                  {key.isActive ? 'active' : 'revoked'}
                                </span>
                              </div>
                            </div>
                          )) : (
                            <div style={{ color: 'var(--muted)', fontSize: '11px', fontFamily: 'Space Mono, monospace' }}>No keys active.</div>
                          )}
                        </div>
                      </div>

                      {/* Audit activity history */}
                      <div className="dash-card" style={{ marginBottom: 0 }}>
                        <div className="dash-card-title">Account Activity history</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {openUser.recentAudit.length > 0 ? openUser.recentAudit.map((item) => (
                            <div key={item.id} style={{ border: '1px solid var(--border)', padding: '10px', background: 'var(--surface)', fontSize: '11px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 600 }}>{actionLabel(item.action)}</div>
                                  <div style={{ color: 'var(--muted)', fontSize: '9px', marginTop: '2px', truncate: 'true' } as any}>{item.actor}</div>
                                </div>
                                <span style={{ color: 'var(--muted)', fontFamily: 'Space Mono, monospace' }}>{timeAgo(item.createdAt, now)}</span>
                              </div>
                            </div>
                          )) : (
                            <div style={{ color: 'var(--muted)', fontSize: '11px', fontFamily: 'Space Mono, monospace' }}>No operations recorded.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

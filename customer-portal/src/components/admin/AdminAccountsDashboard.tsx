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
    void fetchOverview(range);
  }, [fetchOverview, range]);

  useEffect(() => {
    if (selectedUserId) {
      void fetchUserDetail(selectedUserId, range);
    }
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
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center px-6" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="glass-card p-8 w-full max-w-lg text-center animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-[rgba(239,68,68,0.12)] text-[#f87171] mx-auto mb-4 flex items-center justify-center">
            <X size={20} />
          </div>
          <h2 className="text-xl font-semibold mb-2">Accounts failed to load</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-5">{error}</p>
          <button type="button" onClick={() => void fetchOverview(range)} className="btn-primary inline-flex items-center gap-2">
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading accounts…</p>
        </div>
      </div>
    );
  }

  const summary = data.summary;
  const openUser = selectedUser || null;
  const openUserShell = selectedUser || (selectedUserId ? data.users.find((user) => user.id === selectedUserId) || null : null);

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <div className="glass-card p-6 mb-8 border border-[rgba(99,102,241,0.18)] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at top right, rgba(99,102,241,0.22), transparent 38%)' }} />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] text-xs font-semibold uppercase tracking-wider mb-4 border border-[rgba(99,102,241,0.2)]">
                Universal Account Command Center
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05] mb-3">
                Manage users, keys, plans, and account risk from one place.
              </h1>
              <p className="text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
                This is the owner-facing console for the customer panel. It blends account management, support actions, usage visibility, and operational signals so the site manager can run the platform without leaving the dashboard.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => setRange(option)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${range === option ? 'text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}
                  style={range === option ? { background: 'linear-gradient(135deg, #6366f1, #10b981)' } : { background: 'var(--color-bg-card)' }}
                >
                  {option.toUpperCase()}
                </button>
              ))}
              <button onClick={() => void fetchOverview(range)} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-2">
                <RefreshCw size={14} />
                Refresh
              </button>
              <Link href="/admin/plans" className="btn-secondary text-xs py-1.5 px-3">Plans</Link>
              <Link href="/admin/audit-log" className="btn-secondary text-xs py-1.5 px-3">Activity</Link>
              <Link href="/admin/forecast" className="btn-secondary text-xs py-1.5 px-3">Forecasts</Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4 mb-8">
          {[
            { label: 'Users', value: fmt(summary.totalUsers), sub: `${fmt(summary.verifiedUsers)} verified`, color: '#6366f1' },
            { label: 'Revenue', value: fmtUSD(summary.totalRevenueCents), sub: `${fmt(totalPayingAccounts)} paying`, color: '#10b981' },
            { label: 'Requests', value: fmtTokens(summary.totalRequests), sub: `range ${data.range.toUpperCase()}`, color: '#8b5cf6' },
            { label: 'Tokens', value: fmtTokens(summary.totalTokens), sub: `$${summary.totalCost.toFixed(2)} est. cost`, color: '#ef4444' },
            { label: 'API Keys', value: fmt(summary.totalApiKeys), sub: `${fmt(summary.activeApiKeys)} active`, color: '#f59e0b' },
            { label: 'Locked', value: fmt(totalLockedUsers), sub: 'accounts on hold', color: '#f97316' },
            { label: 'Notes', value: fmt(noteCount), sub: 'accounts with staff notes', color: '#22c55e' },
            { label: 'Flags', value: fmt(totalLockedUsers + noteCount), sub: 'focus list signals', color: '#ec4899' },
          ].map((card, index) => (
            <div key={card.label} className="stat-card" style={{ animationDelay: `${index * 0.04}s` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--color-text-muted)] text-xs font-medium">{card.label}</span>
                <span className="text-base" style={{ color: card.color }}>●</span>
              </div>
              <div className="stat-value text-2xl">{card.value}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">{card.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid xl:grid-cols-[1.35fr_0.65fr] gap-6 mb-8">
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-[var(--color-border)] flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Customer Accounts</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Search, sort, and open detailed actions for any account.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    type="text"
                    className="input-field text-sm py-2 pl-9 w-full sm:w-80"
                    placeholder="Search email, name, plan, or note..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="input-field text-sm py-2 w-full sm:w-44"
                  style={{ appearance: 'auto' }}
                >
                  <option value="recent">Newest First</option>
                  <option value="requests">Most Requests</option>
                  <option value="tokens">Most Tokens</option>
                  <option value="paid">Highest Paid</option>
                  <option value="status">Status Priority</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(['all', 'locked', 'unverified', 'keyless', 'notes', 'highUsage'] as Scope[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setScope(item)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${scope === item ? 'text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}
                    style={scope === item ? { background: 'linear-gradient(135deg, #6366f1, #10b981)' } : { background: 'var(--color-bg-card)' }}
                  >
                    {item === 'all' ? 'All' : item === 'highUsage' ? 'High Usage' : item.charAt(0).toUpperCase() + item.slice(1)}
                  </button>
                ))}
                <button type="button" onClick={saveCurrentView} className="btn-secondary text-xs py-1.5 px-3">Save view</button>
              </div>
                {savedViews.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mr-1">Saved</span>
                    {savedViews.map((view) => (
                    <button
                      key={view.name}
                      type="button"
                      onClick={() => applySavedView(view)}
                      className="px-3 py-1 rounded-full text-[11px] font-medium"
                      style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)' }}
                    >
                      {view.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={exportFilteredCsv} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-2">
                  <Download size={14} />
                  Export CSV
                </button>
                <button type="button" onClick={() => importInputRef.current?.click()} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-2">
                  <Download size={14} />
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
              <div className="px-6 pb-4 text-xs text-[var(--color-text-muted)]">{importStatus}</div>
            )}

            {selectedIds.length > 0 && (
              <div className="px-6 py-4 border-b border-[var(--color-border)]" style={{ background: 'var(--color-bg-secondary)' }}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    <span className="font-semibold text-white">{selectedIds.length}</span> accounts selected
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      className="input-field text-sm py-2 w-40"
                      value={bulkPlanDraft}
                      onChange={(e) => setBulkPlanDraft(e.target.value)}
                      style={{ appearance: 'auto' }}
                    >
                      {summary.planBreakdown.map((plan) => (
                        <option key={plan.id} value={plan.id}>{plan.name}</option>
                      ))}
                    </select>
                    <button className="btn-secondary text-xs py-2 px-4" onClick={() => void submitBulkAction('lock')}>Lock</button>
                    <button className="btn-secondary text-xs py-2 px-4" onClick={() => void submitBulkAction('unlock')}>Unlock</button>
                    <button className="btn-secondary text-xs py-2 px-4" onClick={() => void submitBulkAction('revokeKeys')}>Revoke Keys</button>
                    <button className="btn-primary text-xs py-2 px-4" onClick={() => void submitBulkAction('plan', { planId: bulkPlanDraft })}>Apply Plan</button>
                    <button className="btn-secondary text-xs py-2 px-4" onClick={() => setSelectedIds([])}>Clear</button>
                  </div>
                </div>
              </div>
            )}

              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wider" style={{ background: 'var(--color-bg-secondary)' }}>
                    <th className="px-4 py-3 font-semibold">
                      <input
                        ref={bulkSelectRef}
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(e) => setSelectedIds(e.target.checked ? filteredUsers.map((user) => user.id) : [])}
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-transparent text-[var(--color-accent)]"
                      />
                    </th>
                    <th className="px-6 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Plan</th>
                    <th className="px-4 py-3 font-semibold">Joined</th>
                    <th className="px-4 py-3 font-semibold text-right">Requests</th>
                    <th className="px-4 py-3 font-semibold text-right">Keys</th>
                    <th className="px-4 py-3 font-semibold text-right">Paid</th>
                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                    <th className="px-4 py-3 font-semibold text-center">Notes</th>
                    <th className="px-4 py-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const isSelected = selectedUserId === user.id;
                    return (
                      <tr
                        key={user.id}
                        className={`border-t border-[rgba(255,255,255,0.03)] hover:bg-[var(--color-bg-card)] transition-colors cursor-pointer ${isSelected ? 'bg-[var(--color-bg-card)]' : ''}`}
                        onClick={() => {
                          setSelectedUser(null);
                          setDetailError('');
                          setSelectedUserId(user.id);
                        }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(user.id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => toggleSelection(user.id, e.target.checked)}
                              className="h-4 w-4 rounded border-[var(--color-border)] bg-transparent text-[var(--color-accent)] shrink-0"
                            />
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #10b981)' }}>
                              {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium truncate max-w-[220px]">{user.name || '—'}</div>
                              <div className="text-xs text-[var(--color-text-muted)] truncate max-w-[220px]">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`badge-${user.plan.id === 'free' ? 'warning' : user.plan.id === 'pro' ? 'accent' : 'success'}`}>{user.plan.name}</span>
                        </td>
                        <td className="px-4 py-4 text-[var(--color-text-muted)]">
                          {timeAgo(user.createdAt, now)}
                        </td>
                        <td className="px-4 py-4 text-right font-mono font-medium">{fmt(user.usage.totalRequests)}</td>
                        <td className="px-4 py-4 text-right font-mono">{fmt(user.apiKeys.length)}</td>
                        <td className="px-4 py-4 text-right font-mono" style={{ color: user.totalPaidCents > 0 ? '#10b981' : 'var(--color-text-muted)' }}>
                          {user.totalPaidCents > 0 ? fmtUSD(user.totalPaidCents) : '—'}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {user.isLocked ? (
                            <span className="badge-danger">locked</span>
                          ) : user.emailVerified ? (
                            <span className="badge-success">verified</span>
                          ) : (
                            <span className="badge-warning">pending</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {user.adminNote ? <span className="badge-accent">note</span> : <span className="text-[var(--color-text-muted)]">—</span>}
                        </td>
                        <td className="px-4 py-4 text-right text-[var(--color-text-muted)]">
                          <ChevronRight size={15} className={`inline-block transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-base font-semibold">Attention Queue</h2>
                <span className="badge-accent">{attentionUsers.length}</span>
              </div>
              <div className="space-y-3">
                {attentionUsers.length > 0 ? attentionUsers.map((user) => (
                  <button
                    key={user.id}
                    className="w-full p-3 rounded-xl text-left border border-transparent hover:border-[rgba(99,102,241,0.2)] transition-colors"
                    style={{ background: 'var(--color-bg-primary)' }}
                    onClick={() => {
                      setSelectedUser(null);
                      setDetailError('');
                      setSelectedUserId(user.id);
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{user.name || user.email}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {user.isLocked ? 'Locked' : user.emailVerified ? 'Verified' : 'Needs verification'} · {fmt(user.apiKeys.length)} keys · {fmt(user.usage.totalRequests)} requests
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${user.isLocked ? 'bg-red-500/10 text-red-400' : 'bg-slate-500/10 text-slate-300'}`}>
                        Review
                      </span>
                    </div>
                  </button>
                )) : (
                  <p className="text-sm text-[var(--color-text-muted)]">No accounts need attention right now.</p>
                )}
              </div>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-base font-semibold">Top Models</h2>
                <Activity size={15} className="text-[var(--color-text-muted)]" />
              </div>
              <div className="space-y-2">
                {topModels.length > 0 ? topModels.map((model, index) => (
                  <div key={model.model} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: index === 0 ? 'var(--color-accent-subtle)' : 'transparent' }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-[var(--color-text-muted)] w-5">{index + 1}.</span>
                      <span className="text-sm font-medium font-mono truncate">{model.model}</span>
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">{fmt(model.requests || 0)} reqs</span>
                  </div>
                )) : (
                  <p className="text-sm text-[var(--color-text-muted)] italic">No model usage data yet</p>
                )}
              </div>
            </div>

            <div className="glass-card p-6">
              <h2 className="text-base font-semibold mb-4">Plan Mix</h2>
              <div className="space-y-3">
                {summary.planBreakdown.map((plan) => {
                  const share = summary.totalUsers > 0 ? (plan.userCount / summary.totalUsers) * 100 : 0;
                  return (
                    <div key={plan.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{plan.name}</span>
                        <span className="text-[var(--color-text-muted)]">{fmt(plan.userCount)} users</span>
                      </div>
                      <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(share, 4)}%`, background: 'linear-gradient(90deg, #6366f1, #10b981)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedUserId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-y-0 right-0 w-full max-w-3xl bg-[var(--color-bg-primary)] border-l border-[var(--color-border)] shadow-2xl overflow-y-auto">
            <div className="p-6 border-b border-[var(--color-border)] sticky top-0 z-10" style={{ background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(14px)' }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-3 bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
                    Account Detail
                  </div>
                  <h3 className="text-2xl font-bold">{openUserShell?.name || openUserShell?.email || 'Loading account...'}</h3>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">{openUserShell?.email || 'Fetching detail…'}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedUserId(null);
                    setSelectedUser(null);
                    setDetailError('');
                  }}
                  className="btn-secondary inline-flex items-center gap-2 text-sm px-3 py-2"
                >
                  <X size={16} />
                  Close
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {detailError && <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>{detailError}</div>}

              {detailLoading ? (
                <div className="py-16 flex items-center justify-center">
                  <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : !openUser ? (
                <div className="py-16 text-center text-[var(--color-text-muted)]">
                  <p className="text-lg mb-2">Unable to load account detail</p>
                  <p className="text-sm">Try selecting the account again or refreshing the dashboard.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="stat-card">
                      <div className="text-xs text-[var(--color-text-muted)] mb-1">Requests</div>
                      <div className="stat-value text-2xl">{fmtTokens(openUser.usage.totalRequests)}</div>
                    </div>
                    <div className="stat-card">
                      <div className="text-xs text-[var(--color-text-muted)] mb-1">Tokens</div>
                      <div className="stat-value text-2xl">{fmtTokens(openUser.usage.totalTokens)}</div>
                    </div>
                    <div className="stat-card">
                      <div className="text-xs text-[var(--color-text-muted)] mb-1">API Cost</div>
                      <div className="stat-value text-2xl">{openUser.usage.totalCost.toFixed(4)}</div>
                    </div>
                    <div className="stat-card">
                      <div className="text-xs text-[var(--color-text-muted)] mb-1">Paid</div>
                      <div className="stat-value text-2xl">{openUser.totalPaidCents > 0 ? fmtUSD(openUser.totalPaidCents) : '—'}</div>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-6">
                    <div className="space-y-6">
                      <div className="glass-card p-5">
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Profile State</h4>
                          <div className="flex items-center gap-2">
                            {openUser.isLocked ? <span className="badge-danger">locked</span> : <span className="badge-success">active</span>}
                            {openUser.emailVerified ? <span className="badge-success">verified</span> : <span className="badge-warning">pending</span>}
                          </div>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3 text-sm">
                          <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                            <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Plan</div>
                            <div className="font-semibold">{openUser.plan.name}</div>
                          </div>
                          <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                            <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Joined</div>
                            <div className="font-semibold">{new Date(openUser.createdAt).toLocaleDateString()}</div>
                          </div>
                          <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                            <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Keys</div>
                            <div className="font-semibold">{fmt(openUser.apiKeys.length)}</div>
                          </div>
                          <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                            <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Stripe Customer</div>
                            <div className="font-semibold truncate">{openUser.stripeCustomerId || '—'}</div>
                          </div>
                        </div>
                      </div>

                      <div className="glass-card p-5">
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Internal Note</h4>
                          <PencilLine size={15} className="text-[var(--color-text-muted)]" />
                        </div>
                        <textarea
                          className="input-field min-h-32 w-full resize-y"
                          placeholder="Add support context, risk notes, or follow-up reminders."
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                        />
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="text-xs text-[var(--color-text-muted)]">Shown to staff only. Use this to leave operational context on the account.</span>
                          <button
                            className="btn-primary inline-flex items-center gap-2 text-sm px-4 py-2"
                            onClick={() => void submitAction('note', { note: noteDraft })}
                            disabled={actionLoading === 'note'}
                          >
                            {actionLoading === 'note' ? 'Saving...' : 'Save Note'}
                          </button>
                        </div>
                      </div>

                      <div className="glass-card p-5">
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Plan Control</h4>
                          <KeyRound size={15} className="text-[var(--color-text-muted)]" />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <select
                            className="input-field flex-1"
                            value={planDraft}
                            onChange={(e) => setPlanDraft(e.target.value)}
                            style={{ appearance: 'auto' }}
                          >
                            {summary.planBreakdown.map((plan) => (
                              <option key={plan.id} value={plan.id}>{plan.name}</option>
                            ))}
                          </select>
                          <button
                            className="btn-primary inline-flex items-center gap-2 text-sm px-4 py-2"
                            onClick={() => void submitAction('plan', { planId: planDraft })}
                            disabled={actionLoading === 'plan'}
                          >
                            {actionLoading === 'plan' ? 'Updating...' : 'Apply Plan'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="glass-card p-5">
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Admin Actions</h4>
                        <div className="grid gap-3">
                          <button
                            className="btn-secondary flex items-center justify-between gap-3 px-4 py-3"
                            onClick={() => void (async () => {
                              const result = await submitAction('impersonate');
                              const url = result && typeof result === 'object' ? (result.url as string | undefined) : undefined;
                              if (url) {
                                window.location.assign(url);
                              }
                            })()}
                            disabled={actionLoading === 'impersonate'}
                          >
                            <span className="inline-flex items-center gap-2">
                              <LogIn size={16} />
                              Impersonate account
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">support</span>
                          </button>
                          <button
                            className="btn-secondary flex items-center justify-between gap-3 px-4 py-3"
                            onClick={() => void submitAction('resendVerification')}
                            disabled={actionLoading === 'resendVerification' || openUser.emailVerified}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Mail size={16} />
                              Resend verification
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">support</span>
                          </button>
                          <button
                            className="btn-secondary flex items-center justify-between gap-3 px-4 py-3"
                            onClick={() => void submitAction('resetPassword')}
                            disabled={actionLoading === 'resetPassword'}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Send size={16} />
                              Send password reset
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">support</span>
                          </button>
                          <button
                            className="btn-secondary flex items-center justify-between gap-3 px-4 py-3"
                            onClick={() => void submitAction(openUser.isLocked ? 'unlock' : 'lock', { note: noteDraft })}
                            disabled={actionLoading === 'lock' || actionLoading === 'unlock'}
                          >
                            <span className="inline-flex items-center gap-2">
                              {openUser.isLocked ? <Unlock size={16} /> : <LockKeyhole size={16} />}
                              {openUser.isLocked ? 'Unlock account' : 'Lock account'}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">access</span>
                          </button>
                          <button
                            className="btn-secondary flex items-center justify-between gap-3 px-4 py-3"
                            onClick={() => void submitAction('revokeKeys')}
                            disabled={actionLoading === 'revokeKeys'}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Ban size={16} />
                              Revoke all keys
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">api</span>
                          </button>
                          <button
                            className="btn-secondary flex items-center justify-between gap-3 px-4 py-3"
                            onClick={() => void submitAction('note', { note: `${noteDraft}\n\nReviewed at ${new Date().toLocaleString()}`.trim() })}
                            disabled={actionLoading === 'note'}
                          >
                            <span className="inline-flex items-center gap-2">
                              <PencilLine size={16} />
                              Append review note
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">log</span>
                          </button>
                          <button
                            className="btn-secondary flex items-center justify-between gap-3 px-4 py-3"
                            onClick={() => void submitAction('delete')}
                            disabled={actionLoading === 'delete'}
                          >
                            <span className="inline-flex items-center gap-2 text-red-300">
                              <Trash2 size={16} />
                              Soft delete account
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">danger</span>
                          </button>
                        </div>
                      </div>

                      <div className="glass-card p-5">
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">API Keys</h4>
                        <div className="space-y-3">
                          {openUser.apiKeys.length > 0 ? openUser.apiKeys.map((key) => (
                            <div key={key.id} className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-medium">{key.name}</div>
                                  <div className="text-xs text-[var(--color-text-muted)]">
                                    {key.lastFour ? `•••• ${key.lastFour}` : 'No visible suffix'} · {new Date(key.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                                {key.isActive ? <span className="badge-success text-[10px]">active</span> : <span className="badge-danger text-[10px]">revoked</span>}
                              </div>
                            </div>
                          )) : (
                            <p className="text-sm text-[var(--color-text-muted)]">No keys on this account.</p>
                          )}
                        </div>
                      </div>

                      <div className="glass-card p-5">
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Recent Activity</h4>
                        <div className="space-y-3">
                          {openUser.recentAudit.length > 0 ? openUser.recentAudit.map((item) => (
                            <div key={item.id} className="p-3 rounded-xl flex items-start justify-between gap-3" style={{ background: 'var(--color-bg-primary)' }}>
                              <div className="min-w-0">
                                <div className="font-medium">{actionLabel(item.action)}</div>
                                <div className="text-xs text-[var(--color-text-muted)] truncate">{item.targetUserEmail || 'system'} · {item.actor}</div>
                              </div>
                              <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">{timeAgo(item.createdAt, now)}</span>
                            </div>
                          )) : (
                            <p className="text-sm text-[var(--color-text-muted)]">No audit entries yet for this account.</p>
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

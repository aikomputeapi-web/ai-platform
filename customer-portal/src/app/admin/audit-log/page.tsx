'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, ShieldCheck, X } from 'lucide-react';

type Range = '7d' | '30d' | '90d';
type AuditActionFilter =
  | 'all'
  | 'user.signed_up'
  | 'user.key_created'
  | 'user.key_revoked'
  | 'user.locked'
  | 'user.unlocked'
  | 'user.plan_changed'
  | 'user.keys_revoked'
  | 'user.note_updated'
  | 'support.impersonate'
  | 'support.verification_resent'
  | 'support.password_reset_sent'
  | 'support.ticket_created'
  | 'support.ticket_updated'
  | 'billing.credit_created'
  | 'billing.refund_created'
  | 'account.imported'
  | 'report.created'
  | 'report.updated'
  | 'report.sent'
  | 'report.delivery_failed'
  | 'report.delivery_paused'
  | 'report.delivery_resumed'
  | 'report.deleted'
  | 'user.deleted';

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

interface AuditLogData {
  range: string;
  logs: AuditLogItem[];
}

const RANGE_OPTIONS: Range[] = ['7d', '30d', '90d', 'all'];
const ACTION_OPTIONS: AuditActionFilter[] = [
  'all',
  'user.signed_up',
  'user.key_created',
  'user.key_revoked',
  'user.locked',
  'user.unlocked',
  'user.plan_changed',
  'user.keys_revoked',
  'user.note_updated',
  'support.impersonate',
  'support.verification_resent',
  'support.password_reset_sent',
  'support.ticket_created',
  'support.ticket_updated',
  'billing.credit_created',
  'billing.refund_created',
  'account.imported',
  'report.created',
  'report.updated',
  'report.sent',
  'report.delivery_failed',
  'report.delivery_paused',
  'report.delivery_resumed',
  'report.deleted',
  'user.deleted',
];

function timeAgo(value: string, now: number) {
  const seconds = Math.floor((now - new Date(value).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function actionTone(action: string) {
  if (action === 'user.deleted') return 'badge-danger';
  if (action === 'user.keys_revoked' || action === 'user.key_revoked' || action === 'user.locked') return 'badge-warning';
  if (action === 'report.delivery_failed') return 'badge-danger';
  if (action === 'report.sent') return 'badge-success';
  if (action === 'report.delivery_paused') return 'badge-warning';
  if (action === 'report.delivery_resumed') return 'badge-success';
  if (action === 'user.plan_changed' || action === 'user.note_updated' || action === 'user.key_created' || action.startsWith('support.') || action.startsWith('billing.') || action.startsWith('report.') || action === 'account.imported') return 'badge-accent';
  if (action === 'user.signed_up' || action === 'user.unlocked') return 'badge-success';
  return 'badge-success';
}

function describeAction(item: AuditLogItem) {
  switch (item.action) {
    case 'user.signed_up':
      return `${item.targetUserEmail || 'User'} signed up`;
    case 'user.key_created':
      return `API key created for ${item.targetUserEmail || 'user'}`;
    case 'user.key_revoked':
      return `API key revoked for ${item.targetUserEmail || 'user'}`;
    case 'user.locked':
      return `${item.targetUserEmail || 'User'} was locked`;
    case 'user.unlocked':
      return `${item.targetUserEmail || 'User'} was unlocked`;
    case 'user.plan_changed':
      return `${item.targetUserEmail || 'User'} changed plan`;
    case 'user.keys_revoked':
      return `${item.targetUserEmail || 'User'} had API keys revoked`;
    case 'user.note_updated':
      return `${item.targetUserEmail || 'User'} note was updated`;
    case 'support.impersonate':
      return `Impersonation started for ${item.targetUserEmail || 'user'}`;
    case 'support.verification_resent':
      return `Verification email resent for ${item.targetUserEmail || 'user'}`;
    case 'support.password_reset_sent':
      return `Password reset sent for ${item.targetUserEmail || 'user'}`;
    case 'support.ticket_created':
      return `Ticket created for ${item.targetUserEmail || 'user'}`;
    case 'support.ticket_updated':
      return `Ticket updated for ${item.targetUserEmail || 'user'}`;
    case 'billing.credit_created':
      return `Credit created for ${item.targetUserEmail || 'user'}`;
    case 'billing.refund_created':
      return `Refund created for ${item.targetUserEmail || 'user'}`;
    case 'account.imported':
      return 'Accounts imported';
    case 'report.created':
      return 'Scheduled report created';
    case 'report.updated':
      return 'Scheduled report updated';
    case 'report.sent':
      return 'Scheduled report sent';
    case 'report.delivery_failed':
      return 'Scheduled report delivery failed';
    case 'report.delivery_paused':
      return 'Scheduled report delivery paused';
    case 'report.delivery_resumed':
      return 'Scheduled report delivery resumed';
    case 'report.deleted':
      return 'Scheduled report deleted';
    case 'user.deleted':
      return `${item.targetUserEmail || 'User'} was soft deleted`;
    default:
      return item.action;
  }
}

export default function AdminAuditLogPage() {
  const [data, setData] = useState<AuditLogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<Range>('all');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState<AuditActionFilter>('all');
  const [now] = useState(() => Date.now());
  const [focusedLog, setFocusedLog] = useState<AuditLogItem | null>(null);

  const fetchData = useCallback(async (selectedRange: Range = range, selectedAction: AuditActionFilter = action, selectedSearch = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        range: selectedRange,
      });
      if (selectedAction !== 'all') params.set('action', selectedAction);
      if (selectedSearch.trim()) params.set('search', selectedSearch.trim());

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (!res.ok) {
        setError('Failed to load activity log');
        return;
      }
      setData(await res.json());
      setError('');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [action, range, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData(range, action, search);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [range, action, search, fetchData]);

  const filteredCount = useMemo(() => data?.logs.length || 0, [data]);
  const lockEvents = useMemo(() => data?.logs.filter((log) => log.action === 'user.locked').length || 0, [data]);
  const unlockEvents = useMemo(() => data?.logs.filter((log) => log.action === 'user.unlocked').length || 0, [data]);
  const planEvents = useMemo(() => data?.logs.filter((log) => log.action === 'user.plan_changed').length || 0, [data]);

  if (loading || !data) {
    return (
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading audit log…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <div className="glass-card p-6 mb-8 border border-[rgba(16,185,129,0.18)] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at top right, rgba(16,185,129,0.18), transparent 35%)' }} />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(16,185,129,0.12)] text-[rgb(74,222,128)] text-xs font-semibold uppercase tracking-wider mb-4 border border-[rgba(16,185,129,0.2)]">
                Audit Trail
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05] mb-3">
                See what changed, who changed it, and when.
              </h1>
              <p className="text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
                This page is backed by the `audit_logs` table so the owner can review locking, plan changes, key revocations, notes, and deletions from a single source of truth.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => setRange(option)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${range === option ? 'text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}
                  style={range === option ? { background: 'linear-gradient(135deg, #10b981, #6366f1)' } : { background: 'var(--color-bg-card)' }}
                >
                  {option.toUpperCase()}
                </button>
              ))}
              <Link href="/admin/users" className="btn-secondary text-xs py-1.5 px-3">Accounts</Link>
              <button onClick={() => void fetchData(range, action, search)} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-2">
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Events', value: filteredCount.toLocaleString(), sub: `range ${data.range.toUpperCase()}`, color: '#10b981' },
            { label: 'Locks', value: lockEvents.toLocaleString(), sub: 'account holds', color: '#f97316' },
            { label: 'Unlocks', value: unlockEvents.toLocaleString(), sub: 'reopened access', color: '#6366f1' },
            { label: 'Plan Changes', value: planEvents.toLocaleString(), sub: 'subscription updates', color: '#8b5cf6' },
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

        <div className="glass-card overflow-hidden">
          <div className="p-6 border-b border-[var(--color-border)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Audit Entries</h2>
              <p className="text-sm text-[var(--color-text-muted)]">Real admin actions recorded in the platform database.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  className="input-field text-sm py-2 pl-9 w-full sm:w-72"
                  placeholder="Search email, action, or actor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value as AuditActionFilter)}
                className="input-field text-sm py-2 w-full sm:w-52"
                style={{ appearance: 'auto' }}
              >
                {ACTION_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option === 'all' ? 'All Actions' : option}</option>
                ))}
              </select>
              <button onClick={() => void fetchData(range, action, search)} className="btn-secondary text-xs py-2 px-4">Apply</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wider" style={{ background: 'var(--color-bg-secondary)' }}>
                  <th className="px-6 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Account</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">IP</th>
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {data.logs.length > 0 ? data.logs.map((log) => (
                  <tr key={log.id} className="border-t border-[rgba(255,255,255,0.03)] hover:bg-[var(--color-bg-card)] transition-colors">
                    <td className="px-6 py-4">
                      <span className={actionTone(log.action)}>{log.action}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium">{log.targetUserEmail || 'System'}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{describeAction(log)}</div>
                    </td>
                    <td className="px-4 py-4 text-[var(--color-text-muted)]">{log.actor}</td>
                    <td className="px-4 py-4 text-[var(--color-text-muted)]">{log.ipAddress || '—'}</td>
                    <td className="px-4 py-4 text-[var(--color-text-muted)]">{timeAgo(log.createdAt, now)}</td>
                    <td className="px-4 py-4 text-right">
                      <button className="btn-secondary text-xs py-1.5 px-3" onClick={() => setFocusedLog(log)}>
                        Details
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center text-[var(--color-text-muted)]">
                      No audit entries matched the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {focusedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl bg-[var(--color-bg-primary)] border-l border-[var(--color-border)] shadow-2xl overflow-y-auto">
            <div className="p-6 border-b border-[var(--color-border)] sticky top-0 z-10" style={{ background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(14px)' }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-3 bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
                    Entry Detail
                  </div>
                  <h3 className="text-2xl font-bold">{focusedLog.action}</h3>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">{describeAction(focusedLog)}</p>
                </div>
                <button onClick={() => setFocusedLog(null)} className="btn-secondary inline-flex items-center gap-2 text-sm px-3 py-2">
                  <X size={16} />
                  Close
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="glass-card p-4">
                <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Target Account</div>
                <div className="font-medium">{focusedLog.targetUserEmail || 'System'}</div>
                <div className="text-sm text-[var(--color-text-muted)]">{focusedLog.targetUserId || 'No linked user'}</div>
              </div>
              <div className="glass-card p-4">
                <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Metadata</div>
                <pre className="text-xs whitespace-pre-wrap break-words text-[var(--color-text-secondary)]">{focusedLog.metadata ? JSON.stringify(focusedLog.metadata, null, 2) : 'No metadata recorded.'}</pre>
              </div>
              <div className="glass-card p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Actor</div>
                    <div>{focusedLog.actor}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">IP</div>
                    <div>{focusedLog.ipAddress || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">When</div>
                    <div>{new Date(focusedLog.createdAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Relative</div>
                    <div>{timeAgo(focusedLog.createdAt, now)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

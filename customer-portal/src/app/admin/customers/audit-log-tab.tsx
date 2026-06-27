'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';

type Range = '7d' | '30d' | '90d' | 'all';
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
  if (action === 'user.deleted') return 'badge badge-danger';
  if (action === 'user.keys_revoked' || action === 'user.key_revoked' || action === 'user.locked') return 'badge badge-warning';
  if (action === 'report.delivery_failed') return 'badge badge-danger';
  if (action === 'report.sent') return 'badge badge-success';
  if (action === 'report.delivery_paused') return 'badge badge-warning';
  if (action === 'report.delivery_resumed') return 'badge badge-success';
  if (action === 'user.plan_changed' || action === 'user.note_updated' || action === 'user.key_created' || action.startsWith('support.') || action.startsWith('billing.') || action.startsWith('report.') || action === 'account.imported') return 'badge badge-accent';
  if (action === 'user.signed_up' || action === 'user.unlocked') return 'badge badge-success';
  return 'badge badge-success';
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
      <div className="loading-box">
        <div className="auth-spinner" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="dash-page-header flex justify-between items-end flex-wrap gap-20">
        <div>
          <h1 className="dash-page-title">Security & Audit Logs</h1>
          <p className="dash-page-sub">
            Platform operations trace: user signups, access locks, billing changes, and developer API key activities.
          </p>
        </div>
        <div className="flex gap-8">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => setRange(option)}
              className={range === option ? 'btn-xs btn-xs-accent' : 'btn-xs'}
            >
              {option.toUpperCase()}
            </button>
          ))}
          <button
            onClick={() => void fetchData(range, action, search)}
            className="btn-xs"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="error-box">
          Error: {error}
        </div>
      )}

      {/* Metrics */}
      <div className="dash-stats-grid dash-stats-grid-auto">
        {[
          { label: 'Total Events', value: filteredCount.toLocaleString(), sub: `range: ${data.range.toUpperCase()}`, color: 'var(--text)' },
          { label: 'Access Locks', value: lockEvents.toLocaleString(), sub: 'account holds', color: 'var(--muted)' },
          { label: 'Access Unlocks', value: unlockEvents.toLocaleString(), sub: 'restored users', color: 'var(--accent)' },
          { label: 'Plan Modifications', value: planEvents.toLocaleString(), sub: 'pricing tier updates', color: 'var(--accent)' },
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

      {/* Audit List */}
      <div className="dash-card p-0 overflow-hidden">
        <div className="dash-card-title flex justify-between items-center flex-wrap gap-16" style={{ padding: '24px 24px 0 24px' }}>
          <span>Audit Trail Entries</span>
          <div className="flex gap-8 flex-wrap" style={{ paddingBottom: '12px' }}>
            <div className="flex items-center" style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--muted)' }} />
              <input
                type="text"
                className="input-field text-11 mono"
                style={{ padding: '6px 12px 6px 30px', width: '200px' }}
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as AuditActionFilter)}
              className="input-field btn-xs"
              style={{ width: '160px', appearance: 'auto', background: 'var(--bg)' }}
            >
              {ACTION_OPTIONS.map((option) => (
                <option key={option} value={option}>{option === 'all' ? 'All Actions' : option}</option>
              ))}
            </select>
            <button
              onClick={() => void fetchData(range, action, search)}
              className="btn-xs"
            >
              Apply
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="dash-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: '24px' }}>Action Name</th>
                <th>Target Account</th>
                <th>Triggered By</th>
                <th>IP Address</th>
                <th>Timestamp</th>
                <th style={{ paddingRight: '24px' }}></th>
              </tr>
            </thead>
            <tbody>
              {data.logs.length > 0 ? data.logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ paddingLeft: '24px' }}>
                    <span className={`${actionTone(log.action)} text-9`}>{log.action}</span>
                  </td>
                  <td>
                    <div className="font-600">{log.targetUserEmail || 'System'}</div>
                    <div className="text-muted text-11" style={{ marginTop: '2px' }}>{describeAction(log)}</div>
                  </td>
                  <td className="text-bright mono text-11">{log.actor}</td>
                  <td className="text-muted mono text-11">{log.ipAddress || '—'}</td>
                  <td className="text-muted mono text-11">{timeAgo(log.createdAt, now)}</td>
                  <td className="text-right" style={{ paddingRight: '24px' }}>
                    <button
                      className="btn-tiny"
                      onClick={() => setFocusedLog(log)}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="text-center text-muted" style={{ padding: '32px' }}>
                    No audit logs match current query filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out detail drawer */}
      {focusedLog && (
        <div className="drawer-overlay">
          <div
            className="drawer-backdrop"
            onClick={() => setFocusedLog(null)}
          />
          <div className="drawer-panel">
            <div className="drawer-header">
              <div>
                <div className="badge badge-accent mb-6">Log Detail</div>
                <h3 className="font-700 mono" style={{ fontSize: '18px' }}>{focusedLog.action}</h3>
                <p className="text-muted text-12" style={{ marginTop: '4px' }}>{describeAction(focusedLog)}</p>
              </div>
              <button
                onClick={() => setFocusedLog(null)}
                className="btn-xs"
              >
                Close ✕
              </button>
            </div>

            <div className="flex-col gap-20">
              <div className="dash-card mb-0">
                <div className="dash-card-title">Target Account</div>
                <div className="text-12">
                  <div className="font-600">{focusedLog.targetUserEmail || 'System / Platform'}</div>
                  <div className="text-muted mono" style={{ marginTop: '4px' }}>ID: {focusedLog.targetUserId || '—'}</div>
                </div>
              </div>

              <div className="dash-card mb-0">
                <div className="dash-card-title">Metadata payload</div>
                <div className="dash-code" style={{ padding: '12px', border: '1px solid var(--border)' }}>
                  <pre className="dash-code-wrap break-all text-11" style={{ margin: 0 }}>
                    {focusedLog.metadata ? JSON.stringify(focusedLog.metadata, null, 2) : 'No metadata context recorded.'}
                  </pre>
                </div>
              </div>

              <div className="dash-card mb-0">
                <div className="dash-card-title">Context details</div>
                <div className="flex-col gap-8 text-12">
                  <div className="flex justify-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                    <span className="text-muted">Triggered Actor</span>
                    <span className="font-600">{focusedLog.actor}</span>
                  </div>
                  <div className="flex justify-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                    <span className="text-muted">Actor IP Address</span>
                    <span className="font-600 mono">{focusedLog.ipAddress || '—'}</span>
                  </div>
                  <div className="flex justify-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                    <span className="text-muted">Absolute Time</span>
                    <span className="font-600">{new Date(focusedLog.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Relative Time</span>
                    <span className="font-600 mono">{timeAgo(focusedLog.createdAt, now)}</span>
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

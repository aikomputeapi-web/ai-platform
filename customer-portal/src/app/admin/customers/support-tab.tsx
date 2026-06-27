'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';

type Range = '7d' | '30d' | '90d' | 'all';
type TicketStatus = 'all' | 'open' | 'triaged' | 'waiting' | 'closed';
type TicketPriority = 'all' | 'low' | 'normal' | 'high' | 'critical';

interface SupportTicketRow {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  subject: string;
  description: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  internalNotes: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

interface SupportTicketsData {
  summary: {
    open: number;
    triaged: number;
    waiting: number;
    closed: number;
  };
  tickets: SupportTicketRow[];
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

interface AuditLogData {
  range: string;
  logs: AuditLogItem[];
}

const RANGE_OPTIONS: Range[] = ['7d', '30d', '90d', 'all'];
const SUPPORT_ACTIONS = new Set([
  'support.impersonate',
  'support.verification_resent',
  'support.password_reset_sent',
  'support.ticket_created',
  'support.ticket_updated',
]);

function timeAgo(value: string, now: number) {
  const seconds = Math.floor((now - new Date(value).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function describeAction(action: string, email: string | null) {
  switch (action) {
    case 'support.impersonate':
      return `Impersonation started for ${email || 'account'}`;
    case 'support.verification_resent':
      return `Verification email resent for ${email || 'account'}`;
    case 'support.password_reset_sent':
      return `Password reset sent for ${email || 'account'}`;
    case 'support.ticket_created':
      return `Support ticket created for ${email || 'account'}`;
    case 'support.ticket_updated':
      return `Support ticket updated for ${email || 'account'}`;
    default:
      return action;
  }
}

export default function AdminSupportPage() {
  const [ticketsData, setTicketsData] = useState<SupportTicketsData | null>(null);
  const [auditData, setAuditData] = useState<AuditLogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<Range>('all');
  const [search, setSearch] = useState('');
  const [ticketStatus, setTicketStatus] = useState<TicketStatus>('all');
  const [ticketPriority, setTicketPriority] = useState<TicketPriority>('all');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketInternalNotes, setTicketInternalNotes] = useState('');
  const [ticketPriorityDraft, setTicketPriorityDraft] = useState<'low' | 'normal' | 'high' | 'critical'>('normal');
  const [ticketUserEmail, setTicketUserEmail] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketRow | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const fetchData = useCallback(async (selectedRange: Range = range) => {
    setLoading(true);
    try {
      const [ticketsRes, auditRes] = await Promise.all([
        fetch(`/api/admin/support-tickets?search=${encodeURIComponent(search)}&status=${ticketStatus}&priority=${ticketPriority}`),
        fetch(`/api/admin/audit-logs?range=${selectedRange}&search=${encodeURIComponent(search)}`),
      ]);
      if (!ticketsRes.ok || !auditRes.ok) {
        setError('Failed to load support data');
        return;
      }
      setTicketsData(await ticketsRes.json());
      setAuditData(await auditRes.json());
      setError('');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [range, search, ticketPriority, ticketStatus]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData(range);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [range, fetchData]);

  const supportLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (auditData?.logs || []).filter((log) => {
      if (!SUPPORT_ACTIONS.has(log.action)) return false;
      if (!q) return true;
      return (
        log.action.toLowerCase().includes(q) ||
        log.actor.toLowerCase().includes(q) ||
        (log.targetUserEmail || '').toLowerCase().includes(q)
      );
    });
  }, [auditData, search]);

  const queue = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (ticketsData?.tickets || []).filter((ticket) => {
      if (ticketStatus !== 'all' && ticket.status !== ticketStatus) return false;
      if (ticketPriority !== 'all' && ticket.priority !== ticketPriority) return false;
      if (!q) return true;
      return (
        ticket.subject.toLowerCase().includes(q) ||
        ticket.description.toLowerCase().includes(q) ||
        (ticket.userEmail || '').toLowerCase().includes(q) ||
        (ticket.userName || '').toLowerCase().includes(q) ||
        ticket.status.toLowerCase().includes(q) ||
        ticket.priority.toLowerCase().includes(q)
      );
    });
  }, [search, ticketPriority, ticketStatus, ticketsData]);

  const counts = useMemo(() => ({
    impersonations: supportLogs.filter((log) => log.action === 'support.impersonate').length,
    verificationResends: supportLogs.filter((log) => log.action === 'support.verification_resent').length,
    passwordResets: supportLogs.filter((log) => log.action === 'support.password_reset_sent').length,
    tickets: ticketsData?.tickets.length || 0,
  }), [supportLogs, ticketsData]);

  async function createTicket() {
    if (!ticketSubject.trim() || !ticketDescription.trim()) return;
    setActionLoading('create');
    try {
      const res = await fetch('/api/admin/support-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail: ticketUserEmail.trim() || undefined,
          subject: ticketSubject.trim(),
          description: ticketDescription.trim(),
          notes: ticketInternalNotes.trim() || undefined,
          priority: ticketPriorityDraft,
        }),
      });
      if (!res.ok) {
        setError('Failed to create ticket');
        return;
      }
      setTicketSubject('');
      setTicketDescription('');
      setTicketInternalNotes('');
      setTicketUserEmail('');
      setTicketPriorityDraft('normal');
      await fetchData(range);
    } catch {
      setError('Network error');
    } finally {
      setActionLoading(null);
    }
  }

  async function updateTicket(ticketId: string, payload: Record<string, unknown>) {
    setActionLoading(ticketId);
    try {
      const res = await fetch(`/api/admin/support-tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError('Failed to update ticket');
        return;
      }
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket((prev) => prev ? { ...prev, ...payload } : null);
      }
      await fetchData(range);
    } catch {
      setError('Network error');
    } finally {
      setActionLoading(null);
    }
  }

  const statusBadgeClass = (status: string) => {
    if (status === 'closed') return 'badge badge-success';
    if (status === 'waiting') return 'badge badge-warning';
    if (status === 'triaged') return 'badge badge-accent';
    return 'badge badge-danger';
  };

  const priorityBadgeClass = (priority: string) => {
    if (priority === 'critical') return 'badge badge-danger';
    if (priority === 'high') return 'badge badge-warning';
    if (priority === 'low') return 'badge badge-success';
    return 'badge badge-accent';
  };

  if (loading || !ticketsData || !auditData) {
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
          <h1 className="dash-page-title">Support & Escalations</h1>
          <p className="dash-page-sub">
            Review customer support submissions, open troubleshooting tickets, and logs.
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
            onClick={() => void fetchData(range)}
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
          { label: 'Open Tickets', value: ticketsData.summary.open, color: 'var(--accent)', sub: 'needs review' },
          { label: 'Triaged Queue', value: ticketsData.summary.triaged, color: 'var(--text)', sub: 'investigating' },
          { label: 'Waiting Status', value: ticketsData.summary.waiting, color: 'var(--muted)', sub: 'client response' },
          { label: 'Recent Events', value: counts.impersonations + counts.verificationResends + counts.passwordResets, color: 'var(--accent)', sub: 'support log items' },
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

      <div className="dash-grid-2">
        <div className="flex-col gap-24">
          {/* Create Ticket */}
          <div className="dash-card mb-0">
            <div className="dash-card-title">Initiate Support Ticket</div>
            <div className="flex-col gap-12">
              <input
                className="input-field"
                value={ticketUserEmail}
                onChange={(e) => setTicketUserEmail(e.target.value)}
                placeholder="Customer email address..."
              />
              <input
                className="input-field"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="Brief ticket summary..."
              />
              <textarea
                className="input-field"
                style={{ minHeight: '100px', resize: 'vertical' }}
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                placeholder="Elaborate details of customer query..."
              />
              <textarea
                className="input-field"
                style={{ minHeight: '80px', resize: 'vertical' }}
                value={ticketInternalNotes}
                onChange={(e) => setTicketInternalNotes(e.target.value)}
                placeholder="Internal staff troubleshooting context..."
              />
              <div className="flex gap-8 flex-wrap">
                <select
                  className="input-field btn-xs"
                  value={ticketPriorityDraft}
                  onChange={(e) => setTicketPriorityDraft(e.target.value as any)}
                  style={{ flex: 1, appearance: 'auto', background: 'var(--bg)' }}
                >
                  <option value="low">Low Priority</option>
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                  <option value="critical">Critical Priority</option>
                </select>
                <button
                  className="btn-sm"
                  style={{ background: 'var(--accent)', color: 'var(--bg)', border: '1px solid var(--accent)', fontFamily: 'Space Mono, monospace' }}
                  onClick={() => void createTicket()}
                  disabled={actionLoading === 'create'}
                >
                  {actionLoading === 'create' ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            </div>
          </div>

          {/* Support Playbook */}
          <div className="dash-card mb-0">
            <div className="dash-card-title">Support Playbook</div>
            <div className="flex-col gap-8 text-12">
              <div className="border-default bg-surface" style={{ padding: '10px' }}>
                <strong>1. Locate Account Profile</strong>
                <p className="text-muted" style={{ marginTop: '4px' }}>Use the Accounts tab to verify payment tier configurations, API keys, and logs.</p>
              </div>
              <div className="border-default bg-surface" style={{ padding: '10px' }}>
                <strong>2. Queue Escalations</strong>
                <p className="text-muted" style={{ marginTop: '4px' }}>Create tickets directly in the playbook forms when user issues demand staff tracking.</p>
              </div>
              <div className="border-default bg-surface" style={{ padding: '10px' }}>
                <strong>3. Impersonation & Testing</strong>
                <p className="text-muted" style={{ marginTop: '4px' }}>Launch admin impersonation to test the user interface from the customer perspective.</p>
              </div>
            </div>
          </div>

          {/* Support activity log */}
          <div className="dash-card mb-0">
            <div className="dash-card-title">Recent support log events</div>
            <div className="flex-col gap-8">
              {supportLogs.length > 0 ? supportLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="border-default bg-surface text-11 p-12">
                  <div className="flex justify-between items-start" style={{ gap: '8px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="font-600">{describeAction(log.action, log.targetUserEmail)}</div>
                      <div className="text-muted text-9" style={{ marginTop: '2px' }}>{log.actor} · {log.targetUserEmail || 'system'}</div>
                    </div>
                    <span className="text-muted mono">{timeAgo(log.createdAt, now)}</span>
                  </div>
                </div>
              )) : (
                <div className="text-muted mono text-11">No support logs recorded.</div>
              )}
            </div>
          </div>
        </div>

        {/* Escalation queue */}
        <div className="dash-card p-0 overflow-hidden mb-0">
          <div className="dash-card-title flex justify-between items-center flex-wrap gap-16" style={{ padding: '24px 24px 0 24px' }}>
            <span>Escalation Queue</span>
            <div className="flex gap-8 flex-wrap" style={{ paddingBottom: '12px' }}>
              <div className="flex items-center" style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--muted)' }} />
                <input
                  type="text"
                  className="input-field text-11 mono"
                  style={{ padding: '6px 12px 6px 30px', width: '180px' }}
                  placeholder="Filter queue..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                value={ticketStatus}
                onChange={(e) => setTicketStatus(e.target.value as any)}
                className="input-field btn-xs"
                style={{ width: '120px', appearance: 'auto', background: 'var(--bg)' }}
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="triaged">Triaged</option>
                <option value="waiting">Waiting</option>
                <option value="closed">Closed</option>
              </select>
              <select
                value={ticketPriority}
                onChange={(e) => setTicketPriority(e.target.value as any)}
                className="input-field btn-xs"
                style={{ width: '120px', appearance: 'auto', background: 'var(--bg)' }}
              >
                <option value="all">All priority</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '24px' }}>Ticket Subject</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Updated</th>
                  <th style={{ paddingRight: '24px' }}></th>
                </tr>
              </thead>
              <tbody>
                {queue.length > 0 ? queue.map((ticket) => (
                  <tr key={ticket.id}>
                    <td style={{ paddingLeft: '24px' }}>
                      <button style={{ background: 'none', border: 'none', padding: 0, margin: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => setSelectedTicket(ticket)}>
                        <div className="font-600 text-bright">{ticket.subject}</div>
                        <div className="text-muted text-11" style={{ marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', maxWidth: '300px' } as any}>{ticket.description}</div>
                      </button>
                    </td>
                    <td>
                      <div className="font-600">{ticket.userName || ticket.userEmail || 'Unlinked Account'}</div>
                      <div className="text-muted text-10" style={{ marginTop: '2px' }}>{ticket.userEmail || '—'}</div>
                    </td>
                    <td>
                      <span className={`${statusBadgeClass(ticket.status)} text-9`}>{ticket.status}</span>
                    </td>
                    <td>
                      <span className={`${priorityBadgeClass(ticket.priority)} text-9`}>{ticket.priority}</span>
                    </td>
                    <td className="text-muted mono text-11">{timeAgo(ticket.updatedAt, now)}</td>
                    <td className="text-right" style={{ paddingRight: '24px' }}>
                      <div className="flex justify-end" style={{ gap: '6px' }}>
                        <button
                          className="btn-tiny"
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          Open
                        </button>
                        <button
                          className="btn-tiny"
                          onClick={() => void updateTicket(ticket.id, { status: ticket.status === 'closed' ? 'open' : 'closed' })}
                        >
                          {ticket.status === 'closed' ? 'Reopen' : 'Close'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                  <td colSpan={6} className="text-center text-muted" style={{ padding: '32px' }}>
                    No support tickets match the current search filters.
                  </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Ticket detail drawer */}
      {selectedTicket && (
        <div className="drawer-overlay">
          <div
            className="drawer-backdrop"
            onClick={() => setSelectedTicket(null)}
          />
          <div className="drawer-panel">
            <div className="drawer-header">
              <div>
                <div className="badge badge-accent mb-6">Ticket Detail</div>
                <h3 className="font-700 mono" style={{ fontSize: '18px' }}>{selectedTicket.subject}</h3>
                <p className="text-muted text-12" style={{ marginTop: '4px' }}>{selectedTicket.userName || selectedTicket.userEmail || 'Unlinked ticket'}</p>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="btn-xs"
              >
                Close ✕
              </button>
            </div>

            <div className="flex-col gap-20">
              <div className="dash-stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 0 }}>
                <div className="dash-stat">
                  <div className="dash-stat-label">Triage status</div>
                  <div className="dash-stat-value uppercase" style={{ fontSize: '18px' }}>{selectedTicket.status}</div>
                </div>
                <div className="dash-stat">
                  <div className="dash-stat-label">Priority level</div>
                  <div className="dash-stat-value uppercase" style={{ fontSize: '18px' }}>{selectedTicket.priority}</div>
                </div>
              </div>

              <div className="dash-card mb-0">
                <div className="dash-card-title">Description</div>
                <p className="text-12 text-bright" style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.5 }}>
                  {selectedTicket.description}
                </p>
              </div>

              <div className="dash-card mb-0">
                <div className="dash-card-title">Staff Internal Notes</div>
                <p className="text-muted text-11" style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.5 }}>
                  {selectedTicket.internalNotes || 'No notes added for this support ticket.'}
                </p>
              </div>

              <div className="dash-card mb-0">
                <div className="dash-card-title">Ticket administration workflows</div>
                <div className="flex-col gap-12">
                  <div className="flex gap-6 flex-wrap">
                    <button className="btn-xs" onClick={() => void updateTicket(selectedTicket.id, { status: 'triaged' })}>Triage</button>
                    <button className="btn-xs" onClick={() => void updateTicket(selectedTicket.id, { status: 'waiting' })}>Wait Client</button>
                    <button className="btn-xs" onClick={() => void updateTicket(selectedTicket.id, { status: 'closed' })}>Close Ticket</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label className="mono text-muted text-9" style={{ display: 'block', marginBottom: '4px' }}>PRIORITY</label>
                      <select
                        className="input-field"
                        value={selectedTicket.priority}
                        onChange={(e) => void updateTicket(selectedTicket.id, { priority: e.target.value })}
                        style={{ appearance: 'auto', background: 'var(--bg)', width: '100%' }}
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div>
                      <label className="mono text-muted text-9" style={{ display: 'block', marginBottom: '4px' }}>ASSIGN TO</label>
                      <input
                        className="input-field"
                        style={{ width: '100%' }}
                        placeholder="Operator name"
                        defaultValue={selectedTicket.assignedTo || ''}
                        onBlur={(e) => void updateTicket(selectedTicket.id, { assignedTo: e.target.value || null })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mono text-muted text-9" style={{ display: 'block', marginBottom: '4px' }}>STAFF WORKFLOW NOTES</label>
                    <textarea
                      className="input-field"
                      style={{ minHeight: '80px', resize: 'vertical', width: '100%' }}
                      placeholder="Add notes..."
                      defaultValue={selectedTicket.internalNotes || ''}
                      onBlur={(e) => void updateTicket(selectedTicket.id, { internalNotes: e.target.value || null })}
                    />
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

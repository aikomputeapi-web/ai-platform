'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LogIn, RefreshCw, Search, ShieldAlert, X } from 'lucide-react';

type Range = '7d' | '30d' | '90d';
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
      await fetchData(range);
    } catch {
      setError('Network error');
    } finally {
      setActionLoading(null);
    }
  }

  if (loading || !ticketsData || !auditData) {
    return (
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading support workflows…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <div className="glass-card p-6 mb-8 border border-[rgba(99,102,241,0.18)] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at top right, rgba(99,102,241,0.22), transparent 38%)' }} />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] text-xs font-semibold uppercase tracking-wider mb-4 border border-[rgba(99,102,241,0.2)]">
                Support Center
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05] mb-3">
                Triage customer issues and keep a visible support queue.
              </h1>
              <p className="text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
                Use this page to create and manage support tickets, then jump into impersonation and recovery workflows when an account needs hands-on help.
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
              <button onClick={() => void fetchData(range)} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-2">
                <RefreshCw size={14} />
                Refresh
              </button>
              <Link href="/admin/users" className="btn-secondary text-xs py-1.5 px-3">Accounts</Link>
              <Link href="/admin/audit-log" className="btn-secondary text-xs py-1.5 px-3">Activity</Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Open', value: ticketsData.summary.open, color: '#6366f1', sub: 'needs review' },
            { label: 'Triaged', value: ticketsData.summary.triaged, color: '#10b981', sub: 'in progress' },
            { label: 'Waiting', value: ticketsData.summary.waiting, color: '#f59e0b', sub: 'customer follow-up' },
            { label: 'Support Actions', value: counts.impersonations + counts.verificationResends + counts.passwordResets, color: '#ec4899', sub: 'recent support events' },
          ].map((card, index) => (
            <div key={card.label} className="stat-card" style={{ animationDelay: `${index * 0.04}s` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--color-text-muted)] text-xs font-medium">{card.label}</span>
                <span className="text-base" style={{ color: card.color }}>●</span>
              </div>
              <div className="stat-value text-2xl">{card.value.toLocaleString()}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">{card.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid xl:grid-cols-[0.8fr_1.2fr] gap-6">
          <div className="space-y-6">
            <div className="glass-card p-6">
              <h2 className="text-base font-semibold mb-4">Create Ticket</h2>
              <div className="space-y-3">
                <input
                  className="input-field w-full"
                  value={ticketUserEmail}
                  onChange={(e) => setTicketUserEmail(e.target.value)}
                  placeholder="Customer email"
                />
                <input
                  className="input-field w-full"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="Ticket subject"
                />
                <textarea
                  className="input-field w-full min-h-32 resize-y"
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  placeholder="Describe the issue, account context, and next step"
                />
                <textarea
                  className="input-field w-full min-h-24 resize-y"
                  value={ticketInternalNotes}
                  onChange={(e) => setTicketInternalNotes(e.target.value)}
                  placeholder="Internal notes for staff"
                />
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    className="input-field flex-1"
                    value={ticketPriorityDraft}
                    onChange={(e) => setTicketPriorityDraft(e.target.value as typeof ticketPriorityDraft)}
                    style={{ appearance: 'auto' }}
                  >
                    <option value="low">Low priority</option>
                    <option value="normal">Normal priority</option>
                    <option value="high">High priority</option>
                    <option value="critical">Critical</option>
                  </select>
                  <button
                    className="btn-primary px-4 py-2"
                    onClick={() => void createTicket()}
                    disabled={actionLoading === 'create'}
                  >
                    {actionLoading === 'create' ? 'Creating...' : 'Create Ticket'}
                  </button>
                </div>
              </div>
            </div>

            <div className="glass-card p-6">
              <h2 className="text-base font-semibold mb-4">Support Playbook</h2>
              <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                  <div className="font-medium mb-1">1. Find the account</div>
                  <div>Use the Accounts page to inspect plan, keys, notes, and usage patterns.</div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                  <div className="font-medium mb-1">2. Escalate it</div>
                  <div>Create a ticket here when a customer issue needs tracking or follow-up.</div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                  <div className="font-medium mb-1">3. Take action</div>
                  <div>Use the account drawer for impersonation, verification resend, password resets, and key revocation.</div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                  <div className="font-medium mb-1">4. Close the loop</div>
                  <div>Update the ticket status to triaged, waiting, or closed as the issue moves forward.</div>
                </div>
              </div>
            </div>

            <div className="glass-card p-6">
              <h2 className="text-base font-semibold mb-4">Recent Support Activity</h2>
              <div className="space-y-3">
                {supportLogs.length > 0 ? supportLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium">{describeAction(log.action, log.targetUserEmail)}</div>
                        <div className="text-xs text-[var(--color-text-muted)] truncate">{log.actor} · {log.targetUserEmail || 'system'}</div>
                      </div>
                      <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">{timeAgo(log.createdAt, now)}</span>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-[var(--color-text-muted)]">No support actions found in this window.</p>
                )}
              </div>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-[var(--color-border)] flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Escalation Queue</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Active support tickets and their current triage state.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    type="text"
                    className="input-field text-sm py-2 pl-9 w-full sm:w-72"
                    placeholder="Search subject, email, or status..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  value={ticketStatus}
                  onChange={(e) => setTicketStatus(e.target.value as TicketStatus)}
                  className="input-field text-sm py-2 w-full sm:w-36"
                  style={{ appearance: 'auto' }}
                >
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="triaged">Triaged</option>
                  <option value="waiting">Waiting</option>
                  <option value="closed">Closed</option>
                </select>
                <select
                  value={ticketPriority}
                  onChange={(e) => setTicketPriority(e.target.value as TicketPriority)}
                  className="input-field text-sm py-2 w-full sm:w-36"
                  style={{ appearance: 'auto' }}
                >
                  <option value="all">All priority</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wider" style={{ background: 'var(--color-bg-secondary)' }}>
                    <th className="px-6 py-3 font-semibold">Ticket</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Priority</th>
                    <th className="px-4 py-3 font-semibold">Updated</th>
                    <th className="px-4 py-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {queue.length > 0 ? queue.map((ticket) => (
                    <tr key={ticket.id} className="border-t border-[rgba(255,255,255,0.03)] hover:bg-[var(--color-bg-card)] transition-colors">
                      <td className="px-6 py-4">
                        <button className="text-left" onClick={() => setSelectedTicket(ticket)}>
                          <div className="font-medium">{ticket.subject}</div>
                          <div className="text-xs text-[var(--color-text-muted)] line-clamp-2 max-w-[420px]">{ticket.description}</div>
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium">{ticket.userName || ticket.userEmail || 'Unlinked ticket'}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{ticket.userEmail || ticket.userId || 'No customer link'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`badge-${ticket.status === 'closed' ? 'success' : ticket.status === 'waiting' ? 'warning' : ticket.status === 'triaged' ? 'accent' : 'danger'}`}>{ticket.status}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`badge-${ticket.priority === 'critical' ? 'danger' : ticket.priority === 'high' ? 'warning' : ticket.priority === 'low' ? 'success' : 'accent'}`}>{ticket.priority}</span>
                      </td>
                      <td className="px-4 py-4 text-[var(--color-text-muted)]">{timeAgo(ticket.updatedAt, now)}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="btn-secondary text-xs py-1.5 px-3" onClick={() => setSelectedTicket(ticket)}>Open</button>
                          <button className="btn-secondary text-xs py-1.5 px-3" onClick={() => void updateTicket(ticket.id, { status: ticket.status === 'closed' ? 'open' : 'closed' })}>
                            {ticket.status === 'closed' ? 'Reopen' : 'Close'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-[var(--color-text-muted)]">
                        No support tickets match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-6 glass-card p-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-semibold">Support shortcuts</h3>
            <p className="text-sm text-[var(--color-text-muted)]">Impersonate, resend verification, and send password resets from the account drawer on the Accounts page.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/users" className="btn-secondary inline-flex items-center gap-2">
              <LogIn size={15} />
              Open Accounts
            </Link>
            <Link href="/admin/audit-log" className="btn-secondary inline-flex items-center gap-2">
              <ShieldAlert size={15} />
              Review Activity
            </Link>
          </div>
        </div>
      </div>

      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-y-0 right-0 w-full max-w-3xl bg-[var(--color-bg-primary)] border-l border-[var(--color-border)] shadow-2xl overflow-y-auto">
            <div className="p-6 border-b border-[var(--color-border)] sticky top-0 z-10" style={{ background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(14px)' }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-3 bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
                    Ticket Detail
                  </div>
                  <h3 className="text-2xl font-bold">{selectedTicket.subject}</h3>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">{selectedTicket.userName || selectedTicket.userEmail || 'Unlinked ticket'}</p>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="btn-secondary inline-flex items-center gap-2 text-sm px-3 py-2"
                >
                  <X size={16} />
                  Close
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="stat-card">
                  <div className="text-xs text-[var(--color-text-muted)] mb-1">Status</div>
                  <div className="stat-value text-2xl capitalize">{selectedTicket.status}</div>
                </div>
                <div className="stat-card">
                  <div className="text-xs text-[var(--color-text-muted)] mb-1">Priority</div>
                  <div className="stat-value text-2xl capitalize">{selectedTicket.priority}</div>
                </div>
              </div>

              <div className="glass-card p-5">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Description</h4>
                <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              <div className="glass-card p-5">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Internal Notes</h4>
                <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap">
                  {selectedTicket.internalNotes || 'No internal notes yet.'}
                </p>
              </div>

              <div className="glass-card p-5">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Workflow</h4>
                <div className="flex flex-wrap gap-3">
                  <button className="btn-secondary px-4 py-2" onClick={() => void updateTicket(selectedTicket.id, { status: 'triaged' })}>Mark triaged</button>
                  <button className="btn-secondary px-4 py-2" onClick={() => void updateTicket(selectedTicket.id, { status: 'waiting' })}>Mark waiting</button>
                  <button className="btn-secondary px-4 py-2" onClick={() => void updateTicket(selectedTicket.id, { status: 'closed' })}>Close ticket</button>
                </div>
                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                  <select
                    className="input-field"
                    value={selectedTicket.priority}
                    onChange={(e) => void updateTicket(selectedTicket.id, { priority: e.target.value })}
                    style={{ appearance: 'auto' }}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                  <input
                    className="input-field"
                    placeholder="Assigned to"
                    defaultValue={selectedTicket.assignedTo || ''}
                    onBlur={(e) => void updateTicket(selectedTicket.id, { assignedTo: e.target.value || null })}
                  />
                </div>
                <div className="mt-4">
                  <textarea
                    className="input-field w-full min-h-28 resize-y"
                    placeholder="Internal staff notes"
                    defaultValue={selectedTicket.internalNotes || ''}
                    onBlur={(e) => void updateTicket(selectedTicket.id, { internalNotes: e.target.value || null })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

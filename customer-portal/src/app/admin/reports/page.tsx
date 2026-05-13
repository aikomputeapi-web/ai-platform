'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Play, RefreshCw, Search, Plus, Trash2 } from 'lucide-react';

interface ScheduledReport {
  id: string;
  name: string;
  reportType: string;
  recipientEmail: string;
  cadence: string;
  enabled: boolean;
  filters: unknown;
  notes: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DeliveryHistoryItem {
  id: string;
  action: 'report.sent' | 'report.delivery_failed' | string;
  metadata: {
    reportId?: string;
    reportType?: string;
    recipientEmail?: string;
    cadence?: string;
  } | null;
  createdAt: string;
}

interface ReportsData {
  reports: ScheduledReport[];
  deliveryHistory: DeliveryHistoryItem[];
}

interface DeliveryConfig {
  enabled: boolean;
  pausedAt: string | null;
  pausedBy: string | null;
  updatedAt: string | null;
}

export default function AdminReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [reportType, setReportType] = useState('billing');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [cadence, setCadence] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deliveryConfig, setDeliveryConfig] = useState<DeliveryConfig | null>(null);
  const [now] = useState(() => Date.now());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [reportsRes, configRes] = await Promise.all([
        fetch('/api/admin/scheduled-reports'),
        fetch('/api/admin/scheduled-reports/config'),
      ]);
      if (!reportsRes.ok || !configRes.ok) {
        setError('Failed to load scheduled reports');
        return;
      }
      setData(await reportsRes.json());
      const configPayload = await configRes.json();
      setDeliveryConfig(configPayload.config || null);
      setError('');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  const reports = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.reports || []).filter((report) => {
      if (!q) return true;
      return (
        report.name.toLowerCase().includes(q) ||
        report.reportType.toLowerCase().includes(q) ||
        report.recipientEmail.toLowerCase().includes(q) ||
        report.cadence.toLowerCase().includes(q)
      );
    });
  }, [data, search]);

  const deliveryByReportId = useMemo(() => {
    const map = new Map<string, DeliveryHistoryItem>();
    for (const entry of data?.deliveryHistory || []) {
      const reportId = entry.metadata?.reportId;
      if (!reportId || map.has(reportId)) continue;
      map.set(reportId, entry);
    }
    return map;
  }, [data]);

  const deliveryStats = useMemo(() => {
    const reportsList = data?.reports || [];
    const historyList = data?.deliveryHistory || [];
    const lastSuccess = historyList.find((entry) => entry.action === 'report.sent') || null;
    const lastFailure = historyList.find((entry) => entry.action === 'report.delivery_failed') || null;
    const dueReports = reportsList.filter((report) => report.enabled && report.nextRunAt && new Date(report.nextRunAt).getTime() <= now);
    const nextDueAt = dueReports.length
      ? dueReports
          .map((report) => report.nextRunAt!)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]
      : null;

    return {
      lastSuccess,
      lastFailure,
      dueCount: dueReports.length,
      nextDueAt,
    };
  }, [data, now]);

  const automationEnabled = deliveryConfig?.enabled ?? true;

  async function createReport() {
    if (!name.trim() || !reportType.trim() || !recipientEmail.trim()) return;
    setActionLoading('create');
    try {
      const res = await fetch('/api/admin/scheduled-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          reportType: reportType.trim(),
          recipientEmail: recipientEmail.trim(),
          cadence,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setError('Failed to create report');
        return;
      }
      setName('');
      setReportType('billing');
      setRecipientEmail('');
      setCadence('daily');
      setNotes('');
      await fetchData();
    } catch {
      setError('Network error');
    } finally {
      setActionLoading(null);
    }
  }

  async function updateReport(id: string, payload: Record<string, unknown>) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/scheduled-reports/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError('Failed to update report');
        return;
      }
      await fetchData();
    } catch {
      setError('Network error');
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteReport(id: string) {
    setActionLoading(`delete:${id}`);
    try {
      const res = await fetch(`/api/admin/scheduled-reports/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setError('Failed to delete report');
        return;
      }
      await fetchData();
    } catch {
      setError('Network error');
    } finally {
      setActionLoading(null);
    }
  }

  async function deliverDueReports() {
    setActionLoading('deliver-due');
    try {
      const res = await fetch('/api/admin/scheduled-reports/deliver?limit=20', {
        method: 'POST',
      });
      if (!res.ok) {
        setError('Failed to deliver due reports');
        return;
      }
      const payload = await res.json();
      setError('');
      await fetchData();
      if (payload?.processed) {
        window.alert(`Processed ${payload.processed} due report(s): ${payload.sent} sent, ${payload.failed} failed.`);
      }
    } catch {
      setError('Network error');
    } finally {
      setActionLoading(null);
    }
  }

  async function toggleDeliveryAutomation() {
    const nextEnabled = !(deliveryConfig?.enabled ?? true);
    setActionLoading(nextEnabled ? 'resume-delivery' : 'pause-delivery');
    try {
      const res = await fetch('/api/admin/scheduled-reports/config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: nextEnabled, actor: 'admin' }),
      });
      if (!res.ok) {
        setError('Failed to update delivery automation');
        return;
      }
      const payload = await res.json();
      setDeliveryConfig(payload.config || null);
      setError('');
      await fetchData();
    } catch {
      setError('Network error');
    } finally {
      setActionLoading(null);
    }
  }

  if (loading || !data) {
    return (
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading reports…</p>
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
                Reports
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05] mb-3">
                Define recurring operational reports and delivery targets.
              </h1>
              <p className="text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
                This page stores report schedules for billing, usage, accounts, and support so the owner can manage recurring visibility from the dashboard.
              </p>
              <div className="mt-5 inline-flex items-center gap-3 rounded-xl border border-[var(--color-border)] px-4 py-3 bg-[var(--color-bg-secondary)]">
                <span className={`h-2.5 w-2.5 rounded-full ${automationEnabled ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <div>
                  <div className="text-sm font-semibold">
                    {automationEnabled ? 'Automatic delivery enabled' : 'Automatic delivery paused'}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {automationEnabled
                      ? 'The worker will keep sending due reports.'
                      : `Paused${deliveryConfig?.pausedBy ? ` by ${deliveryConfig.pausedBy}` : ''}${deliveryConfig?.pausedAt ? ` at ${new Date(deliveryConfig.pausedAt).toLocaleString()}` : ''}.`}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => void toggleDeliveryAutomation()}
                className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-2"
                disabled={actionLoading === 'pause-delivery' || actionLoading === 'resume-delivery'}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${automationEnabled ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {automationEnabled ? 'Pause Delivery' : 'Resume Delivery'}
              </button>
              <button onClick={() => void fetchData()} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-2">
                <RefreshCw size={14} />
                Refresh
              </button>
              <button onClick={() => void deliverDueReports()} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-2">
                <Play size={14} />
                Deliver Due
              </button>
              <Link href="/admin/users" className="btn-secondary text-xs py-1.5 px-3">Accounts</Link>
              <Link href="/admin/billing" className="btn-secondary text-xs py-1.5 px-3">Billing</Link>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
          <div className="glass-card p-6">
            <h2 className="text-base font-semibold mb-4">Create Schedule</h2>
            <div className="space-y-3">
              <input className="input-field w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="Report name" />
              <select className="input-field w-full" value={reportType} onChange={(e) => setReportType(e.target.value)} style={{ appearance: 'auto' }}>
                <option value="billing">Billing</option>
                <option value="usage">Usage</option>
                <option value="accounts">Accounts</option>
                <option value="support">Support</option>
              </select>
              <input className="input-field w-full" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="Recipient email" />
              <select className="input-field w-full" value={cadence} onChange={(e) => setCadence(e.target.value as 'daily' | 'weekly' | 'monthly')} style={{ appearance: 'auto' }}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <textarea className="input-field w-full min-h-28 resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes" />
              <button className="btn-primary w-full inline-flex items-center justify-center gap-2" onClick={() => void createReport()} disabled={actionLoading === 'create'}>
                <Plus size={15} />
                {actionLoading === 'create' ? 'Creating...' : 'Create Report'}
              </button>
            </div>
            <div className="mt-6 p-4 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Scheduled reports are stored here with next-run timing so the owner or a cron job can deliver them on demand.
              </p>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-[var(--color-border)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Schedules</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Recurring report definitions and delivery targets.</p>
              </div>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  className="input-field text-sm py-2 pl-9 w-full sm:w-72"
                  placeholder="Search name, type, or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wider" style={{ background: 'var(--color-bg-secondary)' }}>
                    <th className="px-6 py-3 font-semibold">Report</th>
                    <th className="px-4 py-3 font-semibold">Recipient</th>
                    <th className="px-4 py-3 font-semibold">Cadence</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Last Delivery</th>
                    <th className="px-4 py-3 font-semibold">Next Run</th>
                    <th className="px-4 py-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {reports.length > 0 ? reports.map((report) => (
                    <tr key={report.id} className="border-t border-[rgba(255,255,255,0.03)] hover:bg-[var(--color-bg-card)] transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium">{report.name}</div>
                        <div className="text-xs text-[var(--color-text-muted)] capitalize">{report.reportType}</div>
                      </td>
                      <td className="px-4 py-4">{report.recipientEmail}</td>
                      <td className="px-4 py-4 capitalize text-[var(--color-text-muted)]">{report.cadence}</td>
                      <td className="px-4 py-4">
                        {report.enabled ? <span className="badge-success">enabled</span> : <span className="badge-warning">paused</span>}
                      </td>
                      <td className="px-4 py-4 text-[var(--color-text-muted)]">
                        {(() => {
                          const delivery = deliveryByReportId.get(report.id);
                          if (!delivery) return '—';
                          const isFailure = delivery.action === 'report.delivery_failed';
                          return (
                            <div className="flex flex-col gap-1">
                              <span className={isFailure ? 'badge-danger' : 'badge-success'}>
                                {isFailure ? 'failed' : 'sent'}
                              </span>
                              <span className="text-xs">{new Date(delivery.createdAt).toLocaleString()}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-4 text-[var(--color-text-muted)]">{report.nextRunAt ? new Date(report.nextRunAt).toLocaleString() : '—'}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-2" onClick={() => void updateReport(report.id, { runNow: true })}>
                            <Play size={14} />
                            Run
                          </button>
                          <button className="btn-secondary text-xs py-1.5 px-3" onClick={() => void updateReport(report.id, { enabled: !report.enabled })}>
                            {report.enabled ? 'Disable' : 'Enable'}
                          </button>
                          <button className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-2 text-red-300" onClick={() => void deleteReport(report.id)}>
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-[var(--color-text-muted)]">
                        No scheduled reports yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
          {[
            {
              label: 'Automation',
              value: automationEnabled ? 'Enabled' : 'Paused',
              sub: automationEnabled ? 'Worker is polling' : 'Worker is paused',
              tone: automationEnabled ? '#10b981' : '#f59e0b',
            },
            {
              label: 'Due Reports',
              value: deliveryStats.dueCount.toLocaleString(),
              sub: deliveryStats.nextDueAt ? `Next due ${new Date(deliveryStats.nextDueAt).toLocaleString()}` : 'Nothing due right now',
              tone: '#6366f1',
            },
            {
              label: 'Last Success',
              value: deliveryStats.lastSuccess ? 'Sent' : 'None',
              sub: deliveryStats.lastSuccess ? new Date(deliveryStats.lastSuccess.createdAt).toLocaleString() : 'No successful delivery yet',
              tone: '#10b981',
            },
            {
              label: 'Last Failure',
              value: deliveryStats.lastFailure ? 'Failed' : 'None',
              sub: deliveryStats.lastFailure ? new Date(deliveryStats.lastFailure.createdAt).toLocaleString() : 'No failures recorded',
              tone: '#f43f5e',
            },
          ].map((card) => (
            <div key={card.label} className="glass-card p-4 border border-[var(--color-border)]">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{card.label}</div>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: card.tone }} />
              </div>
              <div className="text-2xl font-extrabold tracking-tight" style={{ color: card.tone }}>
                {card.value}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-2">{card.sub}</div>
            </div>
          ))}
        </div>

        <div className="glass-card p-6 mt-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Recent Delivery History</h2>
              <p className="text-sm text-[var(--color-text-muted)]">The most recent scheduled-report sends and failures.</p>
            </div>
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
              {data.deliveryHistory.length.toLocaleString()} events
            </span>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(data.deliveryHistory.slice(0, 6)).map((entry) => (
              <div key={entry.id} className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg-secondary)]">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="font-semibold text-sm">{entry.metadata?.reportType || 'report'}</div>
                  {entry.action === 'report.delivery_failed' ? <span className="badge-danger">failed</span> : <span className="badge-success">sent</span>}
                </div>
                <div className="text-sm text-[var(--color-text-secondary)] mb-2">{entry.metadata?.recipientEmail || 'Unknown recipient'}</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {entry.metadata?.reportId ? `Report ${entry.metadata.reportId} · ` : ''}
                  {new Date(entry.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

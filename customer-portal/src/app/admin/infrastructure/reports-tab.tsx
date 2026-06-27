'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Play, RefreshCw, Plus, Trash2 } from 'lucide-react';

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
    calendar?: string;
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
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 56px)', background: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-16">
          <div className="auth-spinner" />
          <p className="text-13 text-muted mono">Loading reports…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ maxWidth: '1480px', margin: '0 auto', padding: '0 24px 48px 24px' }}>
        {/* Header */}
        <div className="dash-page-header flex flex-wrap gap-20" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="badge badge-accent mb-8" style={{ fontSize: '9px' }}>Reports</div>
            <h1 className="dash-page-title">Operational Reports</h1>
            <p className="dash-page-sub">
              Define recurring operational reports and delivery targets.
            </p>
            <div className="inline-flex items-center gap-12" style={{ padding: '8px 12px', border: '1px solid var(--border)', background: 'var(--surface)', marginTop: '16px' }}>
              <span style={{ height: '8px', width: '8px', borderRadius: '50%', background: automationEnabled ? 'var(--accent)' : '#f59e0b' }} />
              <div>
                <div className="text-12 font-700">
                  {automationEnabled ? 'AUTOMATIC DELIVERY ENABLED' : 'AUTOMATIC DELIVERY PAUSED'}
                </div>
                <div className="text-10 text-muted mono" style={{ marginTop: '2px' }}>
                  {automationEnabled
                    ? 'The worker will keep sending due reports.'
                    : `Paused${deliveryConfig?.pausedBy ? ` by ${deliveryConfig.pausedBy}` : ''}${deliveryConfig?.pausedAt ? ` at ${new Date(deliveryConfig.pausedAt).toLocaleString()}` : ''}.`}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-8 flex-wrap">
            <button
              onClick={() => void toggleDeliveryAutomation()}
              className="btn-outline btn-sm inline-flex items-center gap-6"
              disabled={actionLoading === 'pause-delivery' || actionLoading === 'resume-delivery'}
            >
              <span style={{ height: '6px', width: '6px', borderRadius: '50%', background: automationEnabled ? 'var(--accent)' : '#f59e0b' }} />
              {automationEnabled ? 'Pause Delivery' : 'Resume Delivery'}
            </button>
            <button
              onClick={() => void fetchData()}
              className="btn-outline btn-sm inline-flex items-center gap-6"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
            <button
              onClick={() => void deliverDueReports()}
              className="btn-primary btn-sm inline-flex items-center gap-6"
            >
              <Play size={12} />
              Deliver Due
            </button>
          </div>
        </div>

        {error && (
          <div className="alert-error mb-24">
            {error}
          </div>
        )}

        <div className="dash-grid-2">
          {/* Create Schedule Card */}
          <div className="dash-card mb-0">
            <div className="dash-card-title">Create Schedule</div>
            <div className="flex flex-col gap-12">
              <div>
                <label className="auth-label">Report Name</label>
                <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Report name" />
              </div>
              <div>
                <label className="auth-label">Report Type</label>
                <select className="input-field" value={reportType} onChange={(e) => setReportType(e.target.value)} style={{ background: 'var(--surface)' }}>
                  <option value="billing">Billing</option>
                  <option value="usage">Usage</option>
                  <option value="accounts">Accounts</option>
                  <option value="support">Support</option>
                </select>
              </div>
              <div>
                <label className="auth-label">Recipient Email</label>
                <input className="input-field" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="Recipient email" />
              </div>
              <div>
                <label className="auth-label">Cadence</label>
                <select className="input-field" value={cadence} onChange={(e) => setCadence(e.target.value as 'daily' | 'weekly' | 'monthly')} style={{ background: 'var(--surface)' }}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="auth-label">Internal Notes</label>
                <textarea className="input-field" style={{ minHeight: '80px', resize: 'vertical' }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes" />
              </div>
              <button className="btn-accent w-full" style={{ marginTop: '8px' }} onClick={() => void createReport()} disabled={actionLoading === 'create'}>
                {actionLoading === 'create' ? 'Creating...' : 'Create Report'}
              </button>
            </div>
            <div className="text-11 text-muted" style={{ border: '1px solid var(--border)', background: 'var(--bg)', padding: '12px', marginTop: '16px', lineHeight: '1.4' }}>
              Scheduled reports are stored here with next-run timing so the owner or a cron job can deliver them on demand.
            </div>
          </div>

          {/* Schedules list Card */}
          <div className="dash-card mb-0">
            <div className="dash-card-title flex flex-wrap gap-12" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Schedules</span>
              <input
                type="text"
                className="input-field text-13"
                style={{ maxWidth: '280px', padding: '6px 12px' }}
                placeholder="Search name, type, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="overflow-x-auto" style={{ border: '1px solid var(--border)', background: 'var(--surface)', marginTop: '16px' }}>
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>Recipient</th>
                    <th>Cadence</th>
                    <th>Status</th>
                    <th>Last Delivery</th>
                    <th>Next Run</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.length > 0 ? reports.map((report) => (
                    <tr key={report.id}>
                      <td className="font-600">
                        <div>{report.name}</div>
                        <div className="text-11 text-muted uppercase mono" style={{ marginTop: '2px' }}>{report.reportType}</div>
                      </td>
                      <td className="mono text-12">{report.recipientEmail}</td>
                      <td className="text-muted mono" style={{ textTransform: 'capitalize' }}>{report.cadence}</td>
                      <td>
                        {report.enabled ? <span className="badge badge-success">enabled</span> : <span className="badge badge-warning">paused</span>}
                      </td>
                      <td className="text-11">
                        {(() => {
                          const delivery = deliveryByReportId.get(report.id);
                          if (!delivery) return <span className="text-muted">—</span>;
                          const isFailure = delivery.action === 'report.delivery_failed';
                          return (
                            <div className="flex flex-col gap-4">
                              <span className={`badge ${isFailure ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '8px', alignSelf: 'flex-start' }}>
                                {isFailure ? 'failed' : 'sent'}
                              </span>
                              <span className="text-muted text-10 mono">{new Date(delivery.createdAt).toLocaleString()}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="text-11 text-muted mono">
                        {report.nextRunAt ? new Date(report.nextRunAt).toLocaleString() : '—'}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-6">
                          <button
                            className="btn-outline btn-small inline-flex items-center gap-4"
                            onClick={() => void updateReport(report.id, { runNow: true })}
                          >
                            <Play size={10} /> Run
                          </button>
                          <button
                            className="btn-outline btn-small"
                            onClick={() => void updateReport(report.id, { enabled: !report.enabled })}
                          >
                            {report.enabled ? 'Pause' : 'Resume'}
                          </button>
                          <button
                            className="btn-outline btn-small"
                            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                            onClick={() => void deleteReport(report.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="text-center text-muted" style={{ padding: '32px' }}>
                        No scheduled reports yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="dash-stats-grid mt-24">
          {[
            {
              label: 'Automation',
              value: automationEnabled ? 'Enabled' : 'Paused',
              sub: automationEnabled ? 'Worker is polling' : 'Worker is paused',
              color: automationEnabled ? 'var(--accent)' : '#f59e0b',
            },
            {
              label: 'Due Reports',
              value: deliveryStats.dueCount.toString(),
              sub: deliveryStats.nextDueAt ? `Next due ${new Date(deliveryStats.nextDueAt).toLocaleString()}` : 'Nothing due right now',
              color: 'var(--text)',
            },
            {
              label: 'Last Success',
              value: deliveryStats.lastSuccess ? 'Sent' : 'None',
              sub: deliveryStats.lastSuccess ? new Date(deliveryStats.lastSuccess.createdAt).toLocaleString() : 'No successful delivery yet',
              color: 'var(--accent)',
            },
            {
              label: 'Last Failure',
              value: deliveryStats.lastFailure ? 'Failed' : 'None',
              sub: deliveryStats.lastFailure ? new Date(deliveryStats.lastFailure.createdAt).toLocaleString() : 'No failures recorded',
              color: '#ef4444',
            },
          ].map((card) => (
            <div key={card.label} className="dash-stat">
              <div className="dash-stat-label">
                <span>{card.label}</span>
                <span style={{ color: card.color }}>●</span>
              </div>
              <div className="dash-stat-value" style={{ color: card.color as string }}>{card.value}</div>
              <div className="dash-stat-sub">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Recent Delivery History */}
        <div className="dash-card mt-24">
          <div className="dash-card-title flex-between">
            <span>Recent Delivery History</span>
            <span className="badge" style={{ fontSize: '9px' }}>
              {data.deliveryHistory.length.toLocaleString()} events
            </span>
          </div>
          <p className="text-13 text-muted mb-16">The most recent scheduled-report sends and failures.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {data.deliveryHistory.slice(0, 6).map((entry) => (
              <div key={entry.id} className="card" style={{ padding: '16px' }}>
                <div className="flex-between mb-8">
                  <span className="font-700 text-13 mono uppercase">{entry.metadata?.reportType || 'report'}</span>
                  {entry.action === 'report.delivery_failed' ? (
                    <span className="badge badge-danger" style={{ fontSize: '8px' }}>failed</span>
                  ) : (
                    <span className="badge badge-success" style={{ fontSize: '8px' }}>sent</span>
                  )}
                </div>
                <div className="text-12 mono" style={{ color: 'var(--text)', marginBottom: '6px' }}>{entry.metadata?.recipientEmail || 'Unknown recipient'}</div>
                <div className="text-10 text-muted mono">
                  {entry.metadata?.reportId ? `Report ${entry.metadata.reportId.slice(0, 8)}... · ` : ''}
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

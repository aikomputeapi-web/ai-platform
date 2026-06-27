'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Bell, ShieldAlert, Sparkles } from 'lucide-react';

type SettingsData = {
  config: {
    maintenance: { enabled: boolean; message: string; updatedAt: string | null };
    support: { email: string; updatedAt: string | null };
    announcement: { enabled: boolean; message: string; updatedAt: string | null };
  };
};

type ReportConfig = {
  config: { enabled: boolean; pausedAt: string | null; pausedBy: string | null; updatedAt: string | null };
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [reportConfig, setReportConfig] = useState<ReportConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, reportRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/scheduled-reports/config'),
      ]);

      if (!settingsRes.ok || !reportRes.ok) {
        setError('Failed to load settings');
        return;
      }

      setSettings(await settingsRes.json());
      setReportConfig(await reportRes.json());
      setError('');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  async function saveSettings(next: Partial<SettingsData['config']> & { reportDeliveryEnabled?: boolean }) {
    setSaving(true);
    try {
      const requests: Promise<Response>[] = [];

      if (next.maintenance || next.support || next.announcement) {
        requests.push(
          fetch('/api/admin/settings', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              maintenance: next.maintenance,
              support: next.support,
              announcement: next.announcement,
              actor: 'admin',
            }),
          })
        );
      }

      if (typeof next.reportDeliveryEnabled === 'boolean') {
        requests.push(
          fetch('/api/admin/scheduled-reports/config', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              enabled: next.reportDeliveryEnabled,
              actor: 'admin',
            }),
          })
        );
      }

      const responses = await Promise.all(requests);
      if (responses.some((response) => !response.ok)) {
        setError('Failed to save settings');
        return;
      }

      await fetchData();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  if (loading || !settings || !reportConfig) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 56px)', background: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-16">
          <div className="auth-spinner" />
          <p className="text-13 text-muted mono">Loading settings…</p>
        </div>
      </div>
    );
  }

  const maintenance = settings.config.maintenance;
  const support = settings.config.support;
  const announcement = settings.config.announcement;
  const reportDelivery = reportConfig.config;

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ maxWidth: '1480px', margin: '0 auto', padding: '0 24px 48px 24px' }}>
        {/* Header */}
        <div className="dash-page-header flex flex-wrap gap-20" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="badge badge-accent mb-8" style={{ fontSize: '9px' }}>Operator Settings</div>
            <h1 className="dash-page-title">Operator Settings</h1>
            <p className="dash-page-sub">
              Control site-wide behavior from one place.
            </p>
          </div>
        </div>

        {error && (
          <div className="alert-error mb-24">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="dash-stats-grid">
          {[
            { label: 'Maintenance', value: maintenance.enabled ? 'On' : 'Off', sub: maintenance.message || 'No message set', color: maintenance.enabled ? '#f59e0b' : 'var(--accent)' },
            { label: 'Support Email', value: support.email, sub: 'customer contact channel', color: 'var(--text)' },
            { label: 'Announcements', value: announcement.enabled ? 'Active' : 'Hidden', sub: announcement.message || 'No announcement set', color: announcement.enabled ? 'var(--text)' : 'var(--muted)' },
            { label: 'Report Delivery', value: reportDelivery.enabled ? 'Enabled' : 'Paused', sub: reportDelivery.pausedBy ? `paused by ${reportDelivery.pausedBy}` : 'auto delivery status', color: reportDelivery.enabled ? 'var(--accent)' : '#ef4444' },
          ].map((card) => (
            <div key={card.label} className="dash-stat">
              <div className="dash-stat-label">
                <span>{card.label}</span>
                <span style={{ color: card.color }}>●</span>
              </div>
              <div className="dash-stat-value truncate" style={{ color: card.color }}>{card.value}</div>
              <div className="dash-stat-sub line-clamp-2">{card.sub}</div>
            </div>
          ))}
        </div>

        <div className="dash-grid-2">
          <div className="flex flex-col gap-24">
            {/* Maintenance Mode Card */}
            <div className="dash-card mb-0">
              <div className="dash-card-title flex-between">
                <span>Maintenance Mode</span>
                <ShieldAlert size={14} className="text-accent" />
              </div>
              <p className="text-13 text-muted mb-16">Pause the public-facing experience for planned work or incidents.</p>

              <div className="dash-stack">
                <label className="flex-between" style={{ padding: '12px', border: '1px solid var(--border)', background: 'var(--bg)' }}>
                  <div>
                    <div className="font-600 text-12">Enable maintenance mode</div>
                    <div className="text-11 text-muted" style={{ marginTop: '2px' }}>Visitors see a maintenance banner when enabled.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={maintenance.enabled}
                    onChange={(e) => setSettings({
                      ...settings,
                      config: {
                        ...settings.config,
                        maintenance: { ...maintenance, enabled: e.target.checked },
                      },
                    })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </label>
                <div>
                  <label className="auth-label">Maintenance message</label>
                  <textarea
                    value={maintenance.message}
                    onChange={(e) => setSettings({
                      ...settings,
                      config: {
                        ...settings.config,
                        maintenance: { ...maintenance, message: e.target.value },
                      },
                    })}
                    className="input-field"
                    style={{ minHeight: '90px', resize: 'vertical' }}
                    placeholder="We’re making the platform faster and more reliable. Please check back soon."
                  />
                </div>
              </div>
            </div>

            {/* Announcement Banner Card */}
            <div className="dash-card mb-0">
              <div className="dash-card-title flex-between">
                <span>Announcement Banner</span>
                <Bell size={14} className="text-accent" />
              </div>
              <p className="text-13 text-muted mb-16">Use this to broadcast a launch note, policy update, or incident message.</p>

              <div className="dash-stack">
                <label className="flex-between" style={{ padding: '12px', border: '1px solid var(--border)', background: 'var(--bg)' }}>
                  <div>
                    <div className="font-600 text-12">Show announcement banner</div>
                    <div className="text-11 text-muted" style={{ marginTop: '2px' }}>Displayed at the top of the public site.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={announcement.enabled}
                    onChange={(e) => setSettings({
                      ...settings,
                      config: {
                        ...settings.config,
                        announcement: { ...announcement, enabled: e.target.checked },
                      },
                    })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </label>
                <div>
                  <label className="auth-label">Announcement message</label>
                  <textarea
                    value={announcement.message}
                    onChange={(e) => setSettings({
                      ...settings,
                      config: {
                        ...settings.config,
                        announcement: { ...announcement, message: e.target.value },
                      },
                    })}
                    className="input-field"
                    style={{ minHeight: '90px', resize: 'vertical' }}
                    placeholder="New model support is live. Check the changelog for details."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-24">
            {/* Support Contact Card */}
            <div className="dash-card mb-0">
              <div className="dash-card-title">Support Contact</div>
              <p className="text-13 text-muted mb-16">Where customer-facing support mail is routed.</p>
              
              <label className="auth-label">Support email</label>
              <input
                type="email"
                value={support.email}
                onChange={(e) => setSettings({
                  ...settings,
                  config: {
                    ...settings.config,
                    support: { ...support, email: e.target.value },
                  },
                })}
                className="input-field"
                placeholder="support@aikompute.com"
              />
              <p className="text-11 text-muted" style={{ marginTop: '12px', lineHeight: '1.4' }}>
                Used as the default contact point across the portal and customer emails.
              </p>
            </div>

            {/* Scheduled Reports Card */}
            <div className="dash-card mb-0">
              <div className="dash-card-title">Scheduled Reports</div>
              <p className="text-13 text-muted mb-16">Keep automated owner reports running or pause them during maintenance.</p>
              
              <div className="flex-between" style={{ padding: '12px', border: '1px solid var(--border)', background: 'var(--bg)', marginBottom: '16px' }}>
                <div>
                  <div className="font-600 text-12">Auto delivery</div>
                  <div className="text-10 text-muted" style={{ marginTop: '2px' }}>
                    {reportDelivery.enabled ? 'Delivery worker is polling due reports.' : 'Automated delivery is paused.'}
                  </div>
                </div>
                <button
                  disabled={saving}
                  onClick={() => void saveSettings({ reportDeliveryEnabled: !reportDelivery.enabled })}
                  className="btn-outline btn-small"
                  style={{ borderColor: reportDelivery.enabled ? '#ef4444' : 'var(--border-bright)', color: reportDelivery.enabled ? '#ef4444' : 'var(--text)' }}
                >
                  {reportDelivery.enabled ? 'Pause' : 'Resume'}
                </button>
              </div>
              <Link href="/admin/reports" className="btn-outline" style={{ display: 'block', textAlign: 'center', padding: '10px', fontSize: '12px', textDecoration: 'none' }}>
                Open Reports Control Center
              </Link>
            </div>

            {/* Save Changes Card */}
            <div className="dash-card mb-0">
              <div className="dash-card-title">Save Changes</div>
              <p className="text-13 text-muted mb-16">Commit all operator settings at once.</p>
              <button
                disabled={saving}
                onClick={() => void saveSettings({
                  maintenance,
                  support,
                  announcement,
                })}
                className="btn-primary w-full"
                style={{ padding: '12px' }}
              >
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

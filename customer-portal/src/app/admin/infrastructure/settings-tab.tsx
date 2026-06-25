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
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading settings…</p>
        </div>
      </div>
    );
  }

  const maintenance = settings.config.maintenance;
  const support = settings.config.support;
  const announcement = settings.config.announcement;
  const reportDelivery = reportConfig.config;

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="glass-card p-6 mb-8 border border-[rgba(245,158,11,0.18)] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at top right, rgba(245,158,11,0.16), transparent 35%)' }} />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(245,158,11,0.12)] text-[rgb(252,211,77)] text-xs font-semibold uppercase tracking-wider mb-4 border border-[rgba(245,158,11,0.2)]">
                Operator Settings
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05] mb-3">
                Control site-wide behavior from one place.
              </h1>
              <p className="text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
                This is the universal control surface for operational toggles, support contact details, announcement banners, and scheduled report delivery.
              </p>
            </div>

          </div>
        </div>

        {error && <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 text-sm">{error}</div>}

        <div className="grid md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Maintenance', value: maintenance.enabled ? 'On' : 'Off', sub: maintenance.message || 'No message set', color: maintenance.enabled ? '#f59e0b' : '#10b981' },
            { label: 'Support Email', value: support.email, sub: 'customer contact channel', color: '#0ea5e9' },
            { label: 'Announcements', value: announcement.enabled ? 'Active' : 'Hidden', sub: announcement.message || 'No announcement set', color: announcement.enabled ? '#ffffff' : '#6b7280' },
            { label: 'Report Delivery', value: reportDelivery.enabled ? 'Enabled' : 'Paused', sub: reportDelivery.pausedBy ? `paused by ${reportDelivery.pausedBy}` : 'auto delivery status', color: reportDelivery.enabled ? '#10b981' : '#ef4444' },
          ].map((card) => (
            <div key={card.label} className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--color-text-muted)] text-xs font-medium">{card.label}</span>
                <span className="text-base" style={{ color: card.color }}>●</span>
              </div>
              <div className="stat-value text-2xl truncate">{card.value}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">{card.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid xl:grid-cols-[1.05fr_0.95fr] gap-6">
          <div className="space-y-6">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Maintenance Mode</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">Pause the public-facing experience for planned work or incidents.</p>
                </div>
                <ShieldAlert size={16} className="text-[var(--color-accent)]" />
              </div>
              <div className="space-y-4">
                <label className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[var(--color-bg-primary)]">
                  <div>
                    <div className="font-medium">Enable maintenance mode</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Visitors see a maintenance banner when enabled.</div>
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
                    className="w-5 h-5 accent-[var(--color-accent)]"
                  />
                </label>
                <div>
                  <label className="block text-sm font-medium mb-2">Maintenance message</label>
                  <textarea
                    value={maintenance.message}
                    onChange={(e) => setSettings({
                      ...settings,
                      config: {
                        ...settings.config,
                        maintenance: { ...maintenance, message: e.target.value },
                      },
                    })}
                    className="input-field min-h-[110px]"
                    placeholder="We’re making the platform faster and more reliable. Please check back soon."
                  />
                </div>
              </div>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Announcement Banner</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">Use this to broadcast a launch note, policy update, or incident message.</p>
                </div>
                <Bell size={16} className="text-[var(--color-accent)]" />
              </div>
              <div className="space-y-4">
                <label className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[var(--color-bg-primary)]">
                  <div>
                    <div className="font-medium">Show announcement banner</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Displayed at the top of the public site.</div>
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
                    className="w-5 h-5 accent-[var(--color-accent)]"
                  />
                </label>
                <div>
                  <label className="block text-sm font-medium mb-2">Announcement message</label>
                  <textarea
                    value={announcement.message}
                    onChange={(e) => setSettings({
                      ...settings,
                      config: {
                        ...settings.config,
                        announcement: { ...announcement, message: e.target.value },
                      },
                    })}
                    className="input-field min-h-[110px]"
                    placeholder="New model support is live. Check the changelog for details."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Support Contact</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">Where customer-facing support mail is routed.</p>
                </div>
                <Sparkles size={16} className="text-[var(--color-accent)]" />
              </div>
              <label className="block text-sm font-medium mb-2">Support email</label>
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
              <p className="text-xs text-[var(--color-text-muted)] mt-3">
                Used as the default contact point across the portal and customer emails.
              </p>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Scheduled Reports</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">Keep automated owner reports running or pause them during maintenance.</p>
                </div>
              </div>
              <div className="rounded-xl p-4 bg-[var(--color-bg-primary)] mb-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium">Auto delivery</div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {reportDelivery.enabled ? 'Delivery worker is polling due reports.' : 'Automated delivery is paused.'}
                    </div>
                  </div>
                  <button
                    disabled={saving}
                    onClick={() => void saveSettings({ reportDeliveryEnabled: !reportDelivery.enabled })}
                    className={`btn-primary text-sm ${reportDelivery.enabled ? 'bg-red-500' : ''}`}
                  >
                    {reportDelivery.enabled ? 'Pause' : 'Resume'}
                  </button>
                </div>
              </div>
              <Link href="/admin/reports" className="btn-secondary w-full text-center py-2">
                Open Reports Control Center
              </Link>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Save Changes</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">Commit all operator settings at once.</p>
                </div>
              </div>
              <button
                disabled={saving}
                onClick={() => void saveSettings({
                  maintenance,
                  support,
                  announcement,
                })}
                className="btn-primary w-full"
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

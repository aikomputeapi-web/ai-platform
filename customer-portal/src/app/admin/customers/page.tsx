'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminAccountsDashboard from '@/components/admin/AdminAccountsDashboard';
import AdminSupportPage from './support-tab';
import AdminAuditLogPage from './audit-log-tab';

function AdminCustomersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'accounts';

  const handleTabChange = (tabName: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabName);
    router.push(`?${params.toString()}`);
  };

  const tabs = [
    { id: 'accounts', label: 'Accounts' },
    { id: 'support', label: 'Support Tickets' },
    { id: 'audit-log', label: 'Activity Logs' }
  ];

  return (
    <div className="min-h-screen text-[var(--color-text-primary)]">
      <div className="max-w-[1400px] mx-auto py-2">
        {/* Tab Switcher */}
        <div className="flex border-b border-[var(--color-border)] mb-8 select-none overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-white text-white'
                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border)]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="animate-fade-in">
          {activeTab === 'accounts' && <AdminAccountsDashboard />}
          {activeTab === 'support' && <AdminSupportPage />}
          {activeTab === 'audit-log' && <AdminAuditLogPage />}
        </div>
      </div>
    </div>
  );
}

export default function AdminCustomersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading Customers Console…</p>
        </div>
      </div>
    }>
      <AdminCustomersPageContent />
    </Suspense>
  );
}

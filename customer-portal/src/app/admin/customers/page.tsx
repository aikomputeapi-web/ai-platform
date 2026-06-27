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
    <div>
      {/* Tab Switcher */}
      <div className="dash-tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`dash-tab ${isActive ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'accounts' && <AdminAccountsDashboard />}
        {activeTab === 'support' && <AdminSupportPage />}
        {activeTab === 'audit-log' && <AdminAuditLogPage />}
      </div>
    </div>
  );
}

export default function AdminCustomersPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="auth-spinner" />
      </div>
    }>
      <AdminCustomersPageContent />
    </Suspense>
  );
}

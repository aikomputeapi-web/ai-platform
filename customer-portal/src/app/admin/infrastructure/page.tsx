'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminOperationsPage from './operations-tab';
import AdminRoutingPage from './routing-tab';
import ModelsAdminPage from './models-tab';
import AdminReportsPage from './reports-tab';
import AdminSettingsPage from './settings-tab';
import CatalogAdminTab from './catalog-tab';
import ProxyControlCenterTab from './proxy-control-tab';

function AdminInfrastructurePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'operations';

  const handleTabChange = (tabName: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabName);
    router.push(`?${params.toString()}`);
  };

  const tabs = [
    { id: 'operations', label: 'Operations' },
    { id: 'routing', label: 'Routing' },
    { id: 'proxy', label: 'Proxy Control Center' },
    { id: 'catalog', label: 'Customer Catalog' },
    { id: 'models', label: 'Model Registry' },
    { id: 'reports', label: 'Scheduled Reports' },
    { id: 'settings', label: 'Global Settings' }
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
        {activeTab === 'operations' && <AdminOperationsPage />}
        {activeTab === 'routing' && <AdminRoutingPage />}
        {activeTab === 'proxy' && <ProxyControlCenterTab />}
        {activeTab === 'catalog' && <CatalogAdminTab />}
        {activeTab === 'models' && <ModelsAdminPage />}
        {activeTab === 'reports' && <AdminReportsPage />}
        {activeTab === 'settings' && <AdminSettingsPage />}
      </div>
    </div>
  );
}

export default function AdminInfrastructurePage() {
  return (
    <Suspense fallback={
      <div className="flex-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="auth-spinner" />
      </div>
    }>
      <AdminInfrastructurePageContent />
    </Suspense>
  );
}

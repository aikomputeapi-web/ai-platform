'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
}

interface NavCategory {
  title: string;
  items: NavItem[];
}

const navCategories: NavCategory[] = [
  {
    title: 'Overview',
    items: [
      { href: '/admin', label: 'Overview', icon: '📊', exact: true },
    ]
  },
  {
    title: 'Management',
    items: [
      { href: '/admin/customers', label: 'Customers', icon: '👥' },
      { href: '/admin/billing', label: 'Financials', icon: '💳' },
      { href: '/admin/infrastructure', label: 'Infrastructure', icon: '⚙️' },
    ]
  }
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Fetch admin session if needed or just use default admin avatar
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.authenticated) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  // Don't show nav on login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
      router.refresh();
      router.push('/admin/login');
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <div className="dash-shell">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="dash-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`dash-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="dash-sidebar-header">
          <Link href="/" className="nav-brand dash-nav-brand">
            AI<span>KOMPUTE</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="dash-sidebar-close">
            ✕
          </button>
        </div>

        <div className="dash-sidebar-label">Admin Console</div>

        {/* Nav */}
        <nav className="dash-sidebar-nav" style={{ padding: '16px 0' }}>
          {navCategories.map(category => (
            <div key={category.title} className="admin-nav-category">
              <div className="admin-nav-category-title">{category.title}</div>
              <div>
                {category.items.map(item => {
                  const isActive = item.exact
                    ? pathname === item.href
                    : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`dash-nav-item ${isActive ? 'active' : ''}`}
                    >
                      <span className="dash-sidebar-nav-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer / User actions */}
        <div className="dash-sidebar-user">
          <div className="dash-user-row">
            <div className="dash-avatar admin-avatar">A</div>
            <div className="dash-user-info">
              <div className="dash-user-name">Administrator</div>
              <div className="dash-user-email">{user?.email || 'admin@aikompute.com'}</div>
            </div>
          </div>
          <div className="dash-user-actions" style={{ marginTop: '12px' }}>
            <Link href="/dashboard" className="dash-logout">← Portal</Link>
            <button onClick={handleLogout} disabled={loggingOut} className="dash-logout">
              {loggingOut ? 'Logging out...' : 'Sign out'}
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="dash-main">
        {/* Mobile Header */}
        <div className="dash-mobile-header">
          <button onClick={() => setSidebarOpen(true)} className="dash-menu-btn" aria-label="Open menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <Link href="/" className="nav-brand dash-nav-brand-mobile">
            AI<span>KOMPUTE</span>
          </Link>
          <div className="dash-mobile-spacer" />
        </div>

        <div className="admin-content">
          {children}
        </div>
      </main>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const adminNav = [
  { href: '/admin', label: 'Overview', icon: '🏠' },
  { href: '/admin/users', label: 'Accounts', icon: '👥' },
  { href: '/admin/billing', label: 'Billing', icon: '💳' },
  { href: '/admin/usage', label: 'Usage', icon: '📈' },
  { href: '/admin/reports', label: 'Reports', icon: '🗓️' },
  { href: '/admin/plans', label: 'Plans', icon: '📦' },
  { href: '/admin/models', label: 'Models', icon: '🧠' },
  { href: '/admin/routing', label: 'Routing', icon: '🛣️' },
  { href: '/admin/forecast', label: 'Forecast', icon: '🔮' },
  { href: '/admin/operations', label: 'Operations', icon: '🛰️' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
  { href: '/admin/support', label: 'Support', icon: '🧭' },
  { href: '/admin/audit-log', label: 'Activity', icon: '📋' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  // Don't show nav on login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
      router.push('/admin/login');
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Admin sub-nav bar */}
      <div className="border-b border-[var(--color-border)]" style={{ background: 'var(--color-bg-secondary)' }}>
        <div className="max-w-[1400px] mx-auto px-6 flex items-center gap-1 h-11">
          {adminNav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                pathname === item.href
                  ? 'text-white'
                  : 'text-[var(--color-text-muted)] hover:text-white'
              }`}
              style={pathname === item.href ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' } : {}}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
          <div className="flex-1" />
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-xs text-[var(--color-text-muted)] hover:text-white transition-colors px-3 py-1 rounded hover:bg-[var(--color-bg-card)]"
          >
            {loggingOut ? 'Logging out...' : '🚪 Logout'}
          </button>
          <Link href="/" className="text-xs text-[var(--color-text-muted)] hover:text-white transition-colors">← Back to Portal</Link>
        </div>
      </div>
      {children}
    </div>
  );
}

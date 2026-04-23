'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const adminNav = [
  { href: '/admin/analytics', label: 'Analytics', icon: '📊' },
  { href: '/admin/forecast', label: 'Forecast Engine', icon: '🔮' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
          <Link href="/" className="text-xs text-[var(--color-text-muted)] hover:text-white transition-colors">← Back to Portal</Link>
        </div>
      </div>
      {children}
    </div>
  );
}

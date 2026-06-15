'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Home,
  Users,
  CreditCard,
  Server,
  LogOut,
  Menu,
  X,
  ExternalLink
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
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
      { href: '/admin', label: 'Overview', icon: Home, exact: true },
    ]
  },
  {
    title: 'Management',
    items: [
      { href: '/admin/customers', label: 'Customers', icon: Users },
      { href: '/admin/billing', label: 'Financials', icon: CreditCard },
      { href: '/admin/infrastructure', label: 'Infrastructure', icon: Server },
    ]
  }
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] select-none">
      {/* Header / Brand */}
      <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-bold text-white tracking-wider text-base">aikompute</span>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold tracking-widest mt-0.5">Admin Console</span>
        </div>
        {mobileMenuOpen && (
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-[var(--color-text-secondary)] hover:text-white p-1 cursor-pointer"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav links */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {navCategories.map(category => (
          <div key={category.title} className="space-y-2">
            <h3 className="text-[10px] font-bold text-[var(--color-text-muted)] tracking-wider uppercase px-3">
              {category.title}
            </h3>
            <div className="space-y-1">
              {category.items.map(item => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      isActive
                        ? 'text-white bg-[var(--color-accent-subtle)] border-l-2 border-white pl-[10px]'
                        : 'text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-card-hover)] border-l-2 border-transparent'
                    }`}
                  >
                    <Icon size={16} className={isActive ? 'text-white' : 'text-[var(--color-text-muted)]'} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer / User actions */}
      <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] space-y-2">
        <Link
          href="/dashboard"
          className="flex items-center justify-between w-full px-3 py-2 rounded-md text-xs text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-card-hover)] transition-colors"
        >
          <span className="flex items-center gap-2">
            <span>←</span> Back to Portal
          </span>
          <ExternalLink size={12} className="text-[var(--color-text-muted)]" />
        </Link>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
        >
          <LogOut size={12} />
          <span>{loggingOut ? 'Logging out...' : 'Logout'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[var(--color-bg-primary)]">
      {/* Desktop Sidebar (Left) */}
      <aside className="hidden lg:block w-64 fixed inset-y-0 left-0 z-20">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Top Header */}
      <header className="lg:hidden flex items-center justify-between px-6 py-4 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] z-20">
        <div className="flex flex-col">
          <span className="font-bold text-white tracking-wider text-base">aikompute</span>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold tracking-widest">Admin</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 text-[var(--color-text-secondary)] hover:text-white transition-colors cursor-pointer"
        >
          <Menu size={24} />
        </button>
      </header>

      {/* Mobile Menu Backdrop & Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer Content */}
          <div className="relative w-64 max-w-xs h-full bg-[var(--color-bg-secondary)] flex flex-col z-40 animate-slide-in">
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Content wrapper */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <main className="flex-1 px-4 py-8 md:px-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

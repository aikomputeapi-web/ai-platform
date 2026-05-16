'use client';

import Link from 'next/link';
import { useState } from 'react';

interface HeaderProps {
  activeTab?: 'features' | 'models' | 'docs' | 'pricing';
}

export default function Header({ activeTab }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: '/features', label: 'Features', key: 'features' },
    { href: '/models', label: 'Models', key: 'models' },
    { href: '/docs', label: 'Docs', key: 'docs' },
    { href: '#pricing', label: 'Pricing', key: 'pricing' },
  ] as const;

  return (
    <header className="border-b border-[var(--color-border)] bg-[rgba(10,10,15,0.85)] backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold text-base sm:text-lg tracking-tight text-white">aikompute</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'text-white bg-[var(--color-accent-subtle)]'
                    : 'text-[var(--color-text-secondary)] hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Auth */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link href="/signup" className="btn-primary py-2 px-4 text-sm">
            Get Started
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-[var(--color-text-primary)] hover:bg-white/5 rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <nav className="px-4 py-4 space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block text-sm font-medium px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'text-white bg-[var(--color-accent-subtle)]'
                      : 'text-[var(--color-text-secondary)] hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="px-4 pb-4 pt-2 border-t border-[var(--color-border)] flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="btn-secondary py-3 px-4 text-sm text-center"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              onClick={() => setMobileMenuOpen(false)}
              className="btn-primary py-3 px-4 text-sm text-center"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

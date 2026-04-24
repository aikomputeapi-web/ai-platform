import Link from 'next/link';

interface HeaderProps {
  activeTab?: 'features' | 'models' | 'docs' | 'pricing';
}

export default function Header({ activeTab }: HeaderProps) {
  const navItems = [
    { href: '/features', label: 'Features', key: 'features' },
    { href: '/models', label: 'Models', key: 'models' },
    { href: '/docs', label: 'Docs', key: 'docs' },
    { href: '#pricing', label: 'Pricing', key: 'pricing' },
  ] as const;

  return (
    <header className="border-b border-[var(--color-border)] bg-[rgba(10,10,15,0.85)] backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
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
          <span className="font-bold text-lg tracking-tight text-white">AI API Platform</span>
        </Link>

        {/* Nav */}
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

        {/* Auth */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors hidden sm:block"
          >
            Sign In
          </Link>
          <Link href="/signup" className="btn-primary py-2 px-4 text-sm">
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

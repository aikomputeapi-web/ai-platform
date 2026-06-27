'use client';

import Link from 'next/link';

export default function Header() {
  return (
    <nav className="site-nav">
      {/* Brand */}
      <Link href="/" className="nav-brand">
        AI<span>KOMPUTE</span>
      </Link>

      {/* Nav links */}
      <div className="nav-links">
        <Link href="/models">MODELS</Link>
        <Link href="/features">FEATURES</Link>
        <Link href="/pricing">PRICING</Link>
        <Link href="/docs">DOCS</Link>
      </div>

      {/* Right — sign in + CTA */}
      <div className="nav-right">
        <Link href="/login" className="nav-signin">SIGN IN</Link>
        <Link href="/signup" className="nav-cta">START FREE →</Link>
      </div>
    </nav>
  );
}
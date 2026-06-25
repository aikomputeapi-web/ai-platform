'use client';

import Link from 'next/link';

export default function Header() {
  return (
    <nav className="flex items-center justify-between max-w-3xl mx-auto w-full px-6 py-5 font-mono text-xs">
      <Link href="/" className="text-white">◇ aikompute</Link>
      <div className="flex items-center gap-5" style={{ color: 'var(--color-grey)' }}>
        <Link href="/models" className="hover:text-white">Models</Link>
        <Link href="/docs" className="hover:text-white">Docs</Link>
        <Link href="/login" className="hover:text-white">Sign in</Link>
        <Link href="/signup" className="btn-outline">Register</Link>
      </div>
    </nav>
  );
}
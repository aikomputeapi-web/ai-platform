'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'radial-gradient(ellipse at top, #1a1a3e 0%, #0a0a0f 60%)' }}>
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </Link>
          <h1 className="text-2xl font-bold">Reset your password</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">
            {sent ? "Email sent! Check your inbox." : "Enter your email and we'll send a reset link."}
          </p>
        </div>

        {sent ? (
          <div className="glass-card p-8 text-center">
            <div className="text-5xl mb-4">📬</div>
            <p className="text-[var(--color-text-secondary)] mb-6">
              If an account exists for <strong className="text-[var(--color-text-primary)]">{email}</strong>, you&apos;ll receive a reset link within a minute.
            </p>
            <Link href="/login" className="btn-primary w-full">Back to Sign In</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="glass-card p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-secondary)]">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="you@example.com" required />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
            <p className="text-center text-sm text-[var(--color-text-secondary)]">
              Remember it? <Link href="/login" className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium">Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

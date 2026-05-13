'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function VerifyPendingContent() {
  const params = useSearchParams();
  const email = params.get('email');

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'radial-gradient(ellipse at top, #1a1a3e 0%, #0a0a0f 60%)' }}>
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </Link>
          <h1 className="text-2xl font-bold">Check your email</h1>
        </div>

        <div className="glass-card p-8 text-center">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-xl font-bold mb-2">Verification email sent</h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            {email ? (
              <>We sent a verification link to <strong className="text-[var(--color-text-primary)]">{email}</strong>. Click the link in the email to activate your account.</>
            ) : (
              <>We sent a verification link to your email address. Click the link in the email to activate your account.</>
            )}
          </p>

          <div className="bg-[rgba(99,102,241,0.1)] border border-[rgba(99,102,241,0.3)] rounded-lg p-4 mb-6">
            <p className="text-sm text-[var(--color-text-secondary)]">
              <strong className="text-[var(--color-text-primary)]">Didn't receive the email?</strong>
              <br />
              Check your spam folder or wait a few minutes for it to arrive.
            </p>
          </div>

          <div className="space-y-3">
            <Link href="/login" className="btn-secondary w-full block text-center">
              Go to Login
            </Link>
            <p className="text-xs text-[var(--color-text-muted)]">
              Already verified? <Link href="/login" className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]">Sign in</Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
          The verification link expires in 24 hours for security.
        </p>
      </div>
    </div>
  );
}

export default function VerifyPendingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'radial-gradient(ellipse at top, #1a1a3e 0%, #0a0a0f 60%)' }}>
        <div className="glass-card p-8 text-center text-[var(--color-text-muted)]">Loading…</div>
      </div>
    }>
      <VerifyPendingContent />
    </Suspense>
  );
}

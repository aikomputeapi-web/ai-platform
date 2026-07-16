'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useState } from 'react';

function VerifyPendingContent() {
  const params = useSearchParams();
  const email = params.get('email');
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleResend() {
    if (!email || resendState === 'sending') return;
    setResendState('sending');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setResendState(res.ok ? 'sent' : 'error');
    } catch {
      setResendState('error');
    }
  }

  return (
    <div className="auth-centered">
      <nav className="auth-nav">
        <Link href="/" className="nav-brand">AI<span>KOMPUTE</span></Link>
        <div className="auth-nav-right">
          Already verified?&nbsp;
          <Link href="/login">Sign in →</Link>
        </div>
      </nav>

      <div className="auth-centered-body">
        <div className="auth-card text-center">
          <div className="auth-card-icon">📧</div>
          <h2>Check Your Email</h2>
          <p>
            {email ? (
              <>We sent a verification link to <strong className="text-bright">{email}</strong>. Click the link in the email to activate your account.</>
            ) : (
              <>We sent a verification link to your email address. Click the link in the email to activate your account.</>
            )}
          </p>

          <div className="info-box">
            <strong>Didn&apos;t receive the email?</strong><br />
            Check your spam folder or wait a few minutes for it to arrive.
            {email && (
              <>
                <br />
                {resendState === 'sent' ? (
                  <span>A new link is on its way — check your inbox.</span>
                ) : resendState === 'error' ? (
                  <span>Something went wrong. Please try again in a minute.</span>
                ) : (
                  <button
                    type="button"
                    className="link-button"
                    onClick={handleResend}
                    disabled={resendState === 'sending'}
                  >
                    {resendState === 'sending' ? 'Sending…' : 'Resend verification email'}
                  </button>
                )}
              </>
            )}
          </div>

          <Link href="/login" className="btn-border block text-center mb-16">
            Go to Login
          </Link>

          <p className="footnote">
            The verification link expires in 24 hours for security.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPendingPage() {
  return (
    <Suspense fallback={
      <div className="auth-centered">
        <nav className="auth-nav">
          <Link href="/" className="nav-brand">AI<span>KOMPUTE</span></Link>
        </nav>
        <div className="auth-centered-body">
          <div className="auth-card text-center">
            <div className="auth-spinner" />
            <p className="text-muted">Loading…</p>
          </div>
        </div>
      </div>
    }>
      <VerifyPendingContent />
    </Suspense>
  );
}

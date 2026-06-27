'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function VerifyContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Missing verification token.'); return; }
    fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(r => r.json()).then(data => {
      if (data.success) {
        setStatus('success');
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        setStatus('error');
        setMessage(data.error || 'Verification failed.');
      }
    }).catch(() => { setStatus('error'); setMessage('Network error.'); });
  }, [token, router]);

  return (
    <div className="auth-card text-center">
      {status === 'loading' && (
        <>
          <div className="auth-spinner" />
          <p className="text-muted">Verifying your email…</p>
        </>
      )}
      {status === 'success' && (
        <>
          <div className="auth-card-icon">✅</div>
          <h2>Email Verified</h2>
          <p>Redirecting to your dashboard…</p>
        </>
      )}
      {status === 'error' && (
        <>
          <div className="auth-card-icon">❌</div>
          <h2>Verification Failed</h2>
          <p>{message}</p>
          <Link href="/signup" className="auth-submit block text-center">
            Sign Up Again
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="auth-centered">
      <nav className="auth-nav">
        <Link href="/" className="nav-brand">AI<span>KOMPUTE</span></Link>
      </nav>
      <div className="auth-centered-body">
        <Suspense fallback={<div className="auth-card text-center"><div className="auth-spinner" /><p className="text-muted">Loading…</p></div>}>
          <VerifyContent />
        </Suspense>
      </div>
    </div>
  );
}

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
    <div className="glass-card p-8 text-center">
      {status === 'loading' && (
        <><div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[var(--color-text-secondary)]">Verifying your email…</p></>
      )}
      {status === 'success' && (
        <><div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold mb-2">Email verified!</h2>
        <p className="text-[var(--color-text-secondary)]">Redirecting to your dashboard…</p></>
      )}
      {status === 'error' && (
        <><div className="text-5xl mb-4">❌</div>
        <h2 className="text-xl font-bold mb-2">Verification failed</h2>
        <p className="text-[var(--color-text-secondary)] mb-6">{message}</p>
        <Link href="/signup" className="btn-primary">Sign Up Again</Link></>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'radial-gradient(ellipse at top, #1a1a3e 0%, #0a0a0f 60%)' }}>
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </Link>
          <h1 className="text-2xl font-bold">Verify your email</h1>
        </div>
        <Suspense fallback={<div className="glass-card p-8 text-center text-[var(--color-text-muted)]">Loading…</div>}>
          <VerifyContent />
        </Suspense>
      </div>
    </div>
  );
}

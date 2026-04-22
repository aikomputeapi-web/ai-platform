'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');

  useEffect(() => {
    if (!token) setError('Invalid reset link. Please request a new one.');
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setLoading(false); return; }
    setDone(true);
    setTimeout(() => router.push('/dashboard'), 1500);
  }

  if (done) return (
    <div className="glass-card p-8 text-center">
      <div className="text-5xl mb-4">✅</div>
      <p className="font-semibold mb-2">Password updated!</p>
      <p className="text-sm text-[var(--color-text-secondary)]">Redirecting to your dashboard…</p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="glass-card p-8 space-y-5">
      {error && <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] rounded-lg px-4 py-3 text-sm text-[#ef4444]">{error}</div>}
      <div>
        <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-secondary)]">New Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="Min 8 characters" required minLength={8} disabled={!token} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-secondary)]">Confirm Password</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="input-field" placeholder="Repeat password" required disabled={!token} />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={loading || !token}>
        {loading ? 'Updating…' : 'Set New Password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'radial-gradient(ellipse at top, #1a1a3e 0%, #0a0a0f 60%)' }}>
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </Link>
          <h1 className="text-2xl font-bold">Choose a new password</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">Must be at least 8 characters long</p>
        </div>
        <Suspense fallback={<div className="glass-card p-8 text-center text-[var(--color-text-muted)]">Loading…</div>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}

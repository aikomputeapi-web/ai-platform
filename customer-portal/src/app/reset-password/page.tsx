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
    <div className="auth-card text-center">
      <div className="auth-card-icon">✅</div>
      <h2>Password Updated</h2>
      <p>Redirecting to your dashboard…</p>
    </div>
  );

  return (
    <div className="auth-card">
      <h2>New Password</h2>
      <p>Must be at least 8 characters long.</p>
      {error && <div className="auth-error">{error}</div>}
      <form onSubmit={handleSubmit} className="auth-form">
        <div>
          <label className="auth-label">New Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="Min 8 characters" required minLength={8} disabled={!token} />
        </div>
        <div>
          <label className="auth-label">Confirm Password</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="input-field" placeholder="Repeat password" required disabled={!token} />
        </div>
        <button type="submit" className="auth-submit" disabled={loading || !token}>
          {loading ? 'Updating...' : 'Set New Password →'}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="auth-centered">
      <nav className="auth-nav">
        <Link href="/" className="nav-brand">AI<span>KOMPUTE</span></Link>
        <div className="auth-nav-right">
          <Link href="/login">← Back to Sign In</Link>
        </div>
      </nav>
      <div className="auth-centered-body">
        <Suspense fallback={<div className="auth-card text-center"><div className="auth-spinner" /><p className="text-muted">Loading…</p></div>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}

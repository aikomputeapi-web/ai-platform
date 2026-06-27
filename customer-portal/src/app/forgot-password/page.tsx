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
    <div className="auth-centered">
      <nav className="auth-nav">
        <Link href="/" className="nav-brand">AI<span>KOMPUTE</span></Link>
        <div className="auth-nav-right">
          Remember it?&nbsp;
          <Link href="/login">Sign in →</Link>
        </div>
      </nav>

      <div className="auth-centered-body">
        {sent ? (
          <div className="auth-card text-center">
            <div className="auth-card-icon">📬</div>
            <h2>Check Your Email</h2>
            <p>
              If an account exists for <strong className="text-bright">{email}</strong>, you&apos;ll receive a reset link within a minute.
            </p>
            <Link href="/login" className="auth-submit block text-center">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <div className="auth-card">
            <h2>Reset Password</h2>
            <p>Enter your email and we&apos;ll send a reset link.</p>
            <form onSubmit={handleSubmit} className="auth-form">
              <div>
                <label className="auth-label">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="developer@domain.com" required />
              </div>
              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link →'}
              </button>
            </form>
            <p className="auth-bottom-text">
              Remember it? <Link href="/login">Sign in</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

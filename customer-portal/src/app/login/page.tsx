'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Invalid email or password'); return; }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuthSignIn(provider: 'google' | 'github') {
    setError('');
    setLoading(true);
    try {
      await signIn(provider, { callbackUrl: '/dashboard' });
    } catch {
      setError('OAuth sign-in failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">

      {/* Top bar */}
      <nav className="auth-nav">
        <Link href="/" className="nav-brand">AI<span>KOMPUTE</span></Link>
        <div className="auth-nav-right">
          No account?&nbsp;
          <Link href="/signup">Start free →</Link>
        </div>
      </nav>

      {/* Form area */}
      <div className="auth-body">
        {/* Left panel — branding */}
        <div className="auth-panel-left">
          <div>
            <div className="auth-eyebrow">● DEVELOPER ACCESS</div>
            <h1 className="auth-heading">
              Sign<br />
              <span className="outline">Back</span><br />
              In.
            </h1>
            <p className="auth-subtext">
              Access your API keys, usage analytics, and billing from your developer dashboard.
            </p>
          </div>
          <div className="auth-footer-tag">
            ALL ANTHROPIC &amp; OPENAI. PLUS TOP OPEN SOURCE.
          </div>
        </div>

        {/* Right panel — form */}
        <div className="auth-panel-right">
          <h2 className="auth-form-title">Sign In</h2>

          {error && <div className="auth-error">{error}</div>}

          {/* OAuth */}
          <div className="oauth-group">
            <button type="button" onClick={() => handleOAuthSignIn('google')} disabled={loading} className="btn-oauth primary">
              Continue with Google
            </button>
            <button type="button" onClick={() => handleOAuthSignIn('github')} disabled={loading} className="btn-oauth secondary">
              Continue with GitHub
            </button>
          </div>

          <div className="auth-divider"><span>or</span></div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div>
              <label className="auth-label">Email Address</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input-field" placeholder="developer@domain.com" required
              />
            </div>
            <div>
              <div className="auth-label-row">
                <label className="auth-label">Password</label>
                <Link href="/forgot-password">Forgot?</Link>
              </div>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="input-field" placeholder="••••••••" required
              />
            </div>
            <button type="submit" disabled={loading} className="auth-submit">
              {loading ? 'Authenticating...' : 'Sign In →'}
            </button>
          </form>

          <p className="auth-bottom-text">
            No account?{' '}
            <Link href="/signup">Create one →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

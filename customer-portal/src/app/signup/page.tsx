'use client';

import { useState, useEffect } from 'react';
import { signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [alreadyAuthAs, setAlreadyAuthAs] = useState<string | null>(null);

  useEffect(() => {
    // Check if already authenticated
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.authenticated && data.user?.email) {
          setAlreadyAuthAs(data.user.email);
        }
      })
      .catch(() => {});

    // Display OAuth error from URL params (NextAuth redirects to /login?error=...)
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        OAuthAccountNotLinked: 'This email is already associated with another account. Please sign in with the original provider.',
        OAuthCallback: 'OAuth sign-in failed. Please try again.',
        AccessDenied: 'Access denied.',
        Configuration: 'Authentication configuration error. Please contact support.',
        Verification: 'The sign-in link is no longer valid. It may have been used already or it has expired.',
      };
      setError(errorMessages[errorParam] || 'An authentication error occurred. Please try again.');
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Signup failed'); return; }
      if (data.requiresVerification) {
        router.push(`/verify-pending?email=${encodeURIComponent(email)}`);
      } else {
        router.push('/dashboard');
      }
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
      // Clear any existing session before starting a new OAuth flow.
      // Without this, if the user is already logged in as account A and
      // picks account B in Google's picker, a failed/incomplete OAuth
      // callback would leave them logged in as A. Clearing first ensures
      // a clean slate — either they log into the account they pick, or
      // they end up logged out (never silently logged into the wrong account).
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      await signOut({ redirect: false }).catch(() => {});
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
          Already have an account?&nbsp;
          <Link href="/login">Sign in →</Link>
        </div>
      </nav>

      {/* Form area */}
      <div className="auth-body">
        {/* Left panel */}
        <div className="auth-panel-left">
          <div>
            <div className="auth-eyebrow">● FREE TIER INCLUDED</div>
            <h1 className="auth-heading">
              Start<br />
              <span className="outline">Building</span><br />
              Free.
            </h1>
            <p className="auth-subtext">
              Get your API key instantly. 50 free requests to start — no credit card required. Access every frontier model from day one.
            </p>
          </div>

          {/* Feature bullets */}
          <div className="auth-feature-list">
            <div className="auth-feature-item">All Anthropic &amp; OpenAI models, plus top open source</div>
            <div className="auth-feature-item">Automatic fallback &amp; smart routing</div>
            <div className="auth-feature-item">Usage dashboard &amp; billing controls</div>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="auth-panel-right">
          <h2 className="auth-form-title">Create Account</h2>

          {alreadyAuthAs && (
            <div className="auth-error" style={{ marginBottom: '1rem' }}>
              You are already signed in as {alreadyAuthAs}.{' '}
              <button
                type="button"
                onClick={async () => {
                  await fetch('/api/auth/logout', { method: 'POST' });
                  await signOut({ callbackUrl: '/signup', redirect: true });
                }}
                style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
              >
                Sign out
              </button>{' '}
              or{' '}
              <Link href="/dashboard" style={{ color: 'inherit', textDecoration: 'underline' }}>
                go to dashboard
              </Link>.
            </div>
          )}

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
              <label className="auth-label">Full Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="Jane Doe" />
            </div>
            <div>
              <label className="auth-label">Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="developer@domain.com" required />
            </div>
            <div>
              <label className="auth-label">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="Min 8 characters" required minLength={8} />
            </div>
            <button type="submit" disabled={loading} className="auth-submit">
              {loading ? 'Creating Account...' : 'Create Account →'}
            </button>
          </form>

          <p className="auth-bottom-text">
            Free tier includes 50 requests/month. No credit card required.
          </p>
        </div>
      </div>
    </div>
  );
}

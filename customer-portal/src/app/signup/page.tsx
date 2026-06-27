'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const [name, setName] = useState('');
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

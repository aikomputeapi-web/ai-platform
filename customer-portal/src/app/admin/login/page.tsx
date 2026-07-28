'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function AdminLoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  // The only legitimate producer of ?redirect is middleware.ts, which always
  // sets an /admin-local pathname. Anything else — an absolute URL, a
  // protocol-relative //host — is a crafted link: router.push() hard-navigates
  // to external URLs, which would open-redirect a just-authenticated admin to
  // an attacker's page. Fall back to /admin for anything off-pattern.
  const rawRedirect = searchParams.get('redirect');
  const redirect =
    rawRedirect === '/admin' || rawRedirect?.startsWith('/admin/')
      ? rawRedirect
      : '/admin';

  // Check if already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/admin/auth/check');
        const data = await res.json();
        if (data.authenticated) {
          router.push(redirect);
        }
      } catch {
        // Not authenticated, stay on login page
      } finally {
        setIsChecking(false);
      }
    };
    void checkAuth();
  }, [router, redirect]);

  if (isChecking) {
    return (
      <div className="auth-centered">
        <div className="auth-centered-body">
          <div className="auth-spinner" />
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Invalid password');
        setLoading(false);
        return;
      }

      router.push(redirect);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-centered">
      <nav className="auth-nav">
        <Link href="/" className="nav-brand">AI<span>KOMPUTE</span></Link>
        <div className="auth-nav-right">
          <Link href="/">← Back to Portal</Link>
        </div>
      </nav>

      <div className="auth-centered-body">
        <div className="auth-card">
          <div className="flex-center gap-16 mb-32">
            <div className="auth-card-icon-box">🛡️</div>
            <div>
              <h2 className="auth-card-title">Admin Login</h2>
              <p className="auth-card-subtitle">Enter your admin password to continue</p>
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div>
              <label htmlFor="password" className="auth-label">Admin Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="input-field"
                autoFocus
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="auth-submit" disabled={loading || !password}>
              {loading ? 'Authenticating...' : 'Login to Admin Dashboard →'}
            </button>
          </form>

          <div className="auth-card-footer">
            <p className="footnote">
              Session expires 30 minutes after login
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <div className="auth-centered">
        <div className="auth-centered-body">
          <div className="auth-spinner" />
        </div>
      </div>
    }>
      <AdminLoginForm />
    </Suspense>
  );
}

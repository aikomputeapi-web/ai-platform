'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AdminLoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/admin';

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

  // Show loading state while checking authentication
  if (isChecking) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: 'var(--color-bg-primary)' }}
      >
        <div className="w-12 h-12 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
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

      // Login successful, redirect
      router.push(redirect);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center px-6" 
      style={{ background: 'var(--color-bg-primary)' }}
    >
      <div className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="glass-card p-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center" 
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <span style={{ fontSize: '1.5rem' }}>🛡️</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Admin Login</h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                Enter your admin password to continue
              </p>
            </div>
          </div>

          {error && (
            <div 
              className="mb-4 p-3 rounded-lg text-sm" 
              style={{ 
                background: 'rgba(239,68,68,0.1)', 
                color: '#ef4444', 
                border: '1px solid rgba(239,68,68,0.2)' 
              }}
            >
              {error}
            </div>
          )}

          <div className="mb-6">
            <label 
              htmlFor="password" 
              className="block text-sm font-medium mb-2"
            >
              Admin Password
            </label>
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

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading || !password}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Authenticating...
              </span>
            ) : (
              'Login to Admin Dashboard'
            )}
          </button>

          <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-text-muted)] text-center">
              Session will expire after 30 minutes of inactivity
            </p>
          </div>
        </form>

        <div className="mt-6 text-center">
          <a 
            href="/" 
            className="text-sm text-[var(--color-text-muted)] hover:text-white transition-colors"
          >
            ← Back to Portal
          </a>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: 'var(--color-bg-primary)' }}
      >
        <div className="w-12 h-12 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AdminLoginForm />
    </Suspense>
  );
}

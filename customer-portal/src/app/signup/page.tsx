'use client';

import { useState } from 'react';
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
      if (!res.ok) {
        setError(data.error || 'Signup failed');
        return;
      }
      router.push('/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'radial-gradient(ellipse at top, #1a1a3e 0%, #0a0a0f 60%)' }}>
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">Start building with AI in minutes</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-8 space-y-5">
          {error && (
            <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] rounded-lg px-4 py-3 text-sm text-[#ef4444]">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-secondary)]">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="John Doe" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-secondary)]">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="you@example.com" required />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-secondary)]">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="Min 8 characters" required minLength={8} />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-[var(--color-text-secondary)]">
            Already have an account?{' '}
            <Link href="/login" className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium">
              Sign in
            </Link>
          </p>
        </form>

        <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
          Free tier includes 100 requests/day. No credit card required.
        </p>
      </div>
    </div>
  );
}

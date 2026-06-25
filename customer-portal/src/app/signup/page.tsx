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
      if (!res.ok) {
        setError(data.error || 'Signup failed');
        return;
      }
      
      // Check if email verification is required
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

  async function handleOAuthSignIn(provider: 'google' | 'github' | 'apple') {
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
    <div className="min-h-screen flex items-center justify-center bg-black px-4 font-mono">
      <div className="w-full max-w-sm font-mono">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-[2px] bg-white mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-white uppercase tracking-tight">[Create Account]</h1>
          <p className="text-[var(--color-text-secondary)] text-[10px] mt-1 font-medium">Register for free developer credentials</p>
        </div>

        {/* Form Container */}
        <div className="glass-card p-6 border-[var(--color-border)] space-y-4 rounded-[2px]">
          {error && (
            <div className="border border-white/20 rounded-[2px] px-3 py-2 text-[10px] text-white bg-white/5 font-medium">
              {error}
            </div>
          )}

          {/* OAuth Buttons */}
          <div className="space-y-2 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleOAuthSignIn('google')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white text-black rounded-[2px] font-bold hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              Continue with Google
            </button>

            <button
              type="button"
              onClick={() => handleOAuthSignIn('github')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-zinc-900 text-white rounded-[2px] border border-[var(--color-border)] hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              Continue with GitHub
            </button>
          </div>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--color-border)]"></div>
            </div>
            <div className="relative flex justify-center text-[9px] font-bold uppercase tracking-wider">
              <span className="px-2 bg-black text-[var(--color-text-muted)] font-mono">or email credentials</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider mb-1.5 text-[var(--color-text-secondary)]">Full Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="John Doe" />
            </div>

            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider mb-1.5 text-[var(--color-text-secondary)]">Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="developer@domain.com" required />
            </div>

            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider mb-1.5 text-[var(--color-text-secondary)]">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="Min 8 characters" required minLength={8} />
            </div>

            <button type="submit" className="btn-primary w-full cursor-pointer" disabled={loading}>
              {loading ? '[Creating Account...]' : '[Create Account]'}
            </button>
          </form>

          <p className="text-center text-[10px] text-[var(--color-text-secondary)] pt-2 border-t border-white/[0.02]">
            Have an account?{' '}
            <Link href="/login" className="text-white hover:underline font-semibold">
              [Sign in]
            </Link>
          </p>
        </div>

        <p className="text-center text-[9px] text-[var(--color-text-muted)] mt-6 uppercase tracking-wider font-bold">
          Free tier includes 50 requests/month total. No credit card required.
        </p>
      </div>
    </div>
  );
}

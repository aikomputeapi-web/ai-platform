import Link from 'next/link';

export default function Features() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-[var(--color-border)] bg-[rgba(10,10,15,0.8)] backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight">AI API Platform</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/features" className="text-sm font-medium text-white transition-colors border-b-2 border-indigo-500 py-5">Features</Link>
            <Link href="/docs" className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors">Docs</Link>
            <Link href="/login" className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors">Sign In</Link>
            <Link href="/signup" className="btn-primary py-2 px-4 text-sm">Get Started</Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-16">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)', filter: 'blur(100px)' }}></div>
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6">
            Intelligent Infrastructure for <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>AI Builders</span>
          </h1>
          <p className="text-xl text-[var(--color-text-secondary)] mb-12 max-w-3xl mx-auto">
            Everything you need to deploy, scale, and manage LLMs in production. We handle the complexity so you can focus on building.
          </p>
        </div>
      </section>

      {/* Feature Diagram */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="glass-card p-2 md:p-4 rounded-2xl border-[var(--color-border)] shadow-[0_0_50px_rgba(99,102,241,0.1)] relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-50 rounded-xl pointer-events-none"></div>
          <img src="/images/routing_diagram_1776911788703.png" alt="Intelligent AI Routing Network Diagram" className="w-full rounded-xl" />
        </div>
      </section>

      {/* Feature Grid */}
      <section className="max-w-7xl mx-auto px-6 py-20 border-t border-[var(--color-border)]">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          <div className="glass-card p-8 group hover:-translate-y-1 transition-transform">
            <div className="w-12 h-12 rounded-lg bg-[var(--color-accent-subtle)] flex items-center justify-center mb-6 text-[var(--color-accent)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Unified API</h3>
            <p className="text-[var(--color-text-secondary)] leading-relaxed">
              One single API endpoint for all models. Seamlessly swap between OpenAI, Anthropic, Gemini, and Llama without modifying your codebase.
            </p>
          </div>

          <div className="glass-card p-8 group hover:-translate-y-1 transition-transform">
            <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-6 text-green-400">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Consolidated Billing</h3>
            <p className="text-[var(--color-text-secondary)] leading-relaxed">
              Stop tracking multiple credit cards and vendor invoices. Pay one unified bill for all your AI usage across every provider.
            </p>
          </div>

          <div className="glass-card p-8 group hover:-translate-y-1 transition-transform">
            <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center mb-6 text-red-400">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Smart Routing</h3>
            <p className="text-[var(--color-text-secondary)] leading-relaxed">
              Automatically fallback to secondary providers or models if your primary choice experiences downtime or rate limits.
            </p>
          </div>

          <div className="glass-card p-8 group hover:-translate-y-1 transition-transform">
            <div className="w-12 h-12 rounded-lg bg-yellow-500/10 flex items-center justify-center mb-6 text-yellow-400">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Advanced Analytics</h3>
            <p className="text-[var(--color-text-secondary)] leading-relaxed">
              Monitor latency, token usage, and cost per request with our beautiful built-in dashboards. Find bottlenecks effortlessly.
            </p>
          </div>

          <div className="glass-card p-8 group hover:-translate-y-1 transition-transform">
            <div className="w-12 h-12 rounded-lg bg-pink-500/10 flex items-center justify-center mb-6 text-pink-400">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Edge Acceleration</h3>
            <p className="text-[var(--color-text-secondary)] leading-relaxed">
              Global edge network ensures your requests are routed through the fastest possible path to the AI providers, minimizing latency.
            </p>
          </div>

          <div className="glass-card p-8 group hover:-translate-y-1 transition-transform">
            <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-6 text-purple-400">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">OpenAI SDK Native</h3>
            <p className="text-[var(--color-text-secondary)] leading-relaxed">
              No need to learn a new proprietary SDK or language. We natively support the OpenAI Chat Completions API format.
            </p>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-12 text-center text-[var(--color-text-muted)]">
        <p className="text-sm">© {new Date().getFullYear()} AI API Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--color-border)] bg-[rgba(10,10,15,0.8)] backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight">AI API Platform</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="#features" className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors">Features</Link>
            <Link href="#pricing" className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors">Pricing</Link>
            <Link href="/login" className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors">Sign In</Link>
            <Link href="/signup" className="btn-primary py-2 px-4 text-sm">Get Started</Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)', filter: 'blur(100px)' }}></div>
        
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] text-xs font-semibold uppercase tracking-wider mb-8 border border-[rgba(99,102,241,0.2)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-accent)]"></span>
            </span>
            Now Available: GPT-4o & Claude 3.5 Sonnet
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
            One API. <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #6366f1, #3b82f6)' }}>
              Every Powerful AI Model.
            </span>
          </h1>
          
          <p className="text-xl text-[var(--color-text-secondary)] mb-12 max-w-3xl mx-auto leading-relaxed">
            Stop juggling multiple provider accounts, rate limits, and billing dashboards. 
            Access OpenAI, Anthropic, Google, and open-source models through a single, 
            lightning-fast unified API endpoint.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="btn-primary text-lg px-8 py-4 w-full sm:w-auto shadow-lg shadow-indigo-500/20">
              Start Building for Free
            </Link>
            <Link href="#docs" className="btn-secondary text-lg px-8 py-4 w-full sm:w-auto">
              View Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Code Demo Section */}
      <section className="py-20 bg-[var(--color-bg-secondary)] border-y border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div className="animate-slide-in">
            <h2 className="text-3xl font-bold mb-6">Drop-in Replacement for OpenAI</h2>
            <p className="text-[var(--color-text-secondary)] text-lg mb-8 leading-relaxed">
              Our API is 100% compatible with the OpenAI SDK format. 
              Just change your base URL and API key, and instantly unlock access to Claude, 
              Gemini, Llama 3, and more without changing your code.
            </p>
            <ul className="space-y-4">
              {[
                'Seamless OpenAI SDK compatibility',
                'Global low-latency edge routing',
                'Automatic fallback on provider downtime',
                'Unified billing and usage analytics'
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-[var(--color-text-primary)] font-medium">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-success)]/10 flex items-center justify-center text-[var(--color-success)] text-sm">✓</div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="glass-card p-6 border-[var(--color-border)] relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none"></div>
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--color-border)]">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <span className="text-xs text-[var(--color-text-muted)] font-mono">app.js</span>
            </div>
            <pre className="text-sm font-mono text-[var(--color-text-primary)] overflow-x-auto leading-relaxed">
              <span className="text-purple-400">import</span> OpenAI <span className="text-purple-400">from</span> <span className="text-green-400">'openai'</span>;<br/><br/>
              <span className="text-[var(--color-text-muted)]">// 1. Just change the base URL & Key</span><br/>
              <span className="text-purple-400">const</span> client = <span className="text-purple-400">new</span> OpenAI(&#123;<br/>
              &nbsp;&nbsp;apiKey: <span className="text-green-400">'ork_your_api_key'</span>,<br/>
              &nbsp;&nbsp;baseURL: <span className="text-green-400">'https://api.yourdomain.com/v1'</span><br/>
              &#125;);<br/><br/>
              <span className="text-[var(--color-text-muted)]">// 2. Access ANY model instantly</span><br/>
              <span className="text-purple-400">const</span> response = <span className="text-purple-400">await</span> client.chat.completions.create(&#123;<br/>
              &nbsp;&nbsp;model: <span className="text-green-400">'claude-3-5-sonnet'</span>, <span className="text-[var(--color-text-muted)]">// 🚀</span><br/>
              &nbsp;&nbsp;messages: [&#123; role: <span className="text-green-400">'user'</span>, content: <span className="text-green-400">'Hello!'</span> &#125;]<br/>
              &#125;);
            </pre>
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section id="pricing" className="py-24">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Simple, transparent pricing</h2>
          <p className="text-[var(--color-text-secondary)] text-lg mb-16 max-w-2xl mx-auto">
            Start for free, upgrade when you need higher rate limits and guaranteed dedicated throughput.
          </p>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto text-left">
            {[
              { name: 'Free', price: '$0', desc: 'Perfect for prototyping', features: ['100 requests/day', '5 req/min rate limit', 'Free-tier models only', 'Community support'] },
              { name: 'Basic', price: '$19', desc: 'For indie hackers', features: ['1,000 requests/day', '20 req/min rate limit', 'All models unlocked', 'Email support'], featured: true },
              { name: 'Pro', price: '$49', desc: 'For scaling startups', features: ['10,000 requests/day', '60 req/min rate limit', 'Priority processing', 'Dedicated support'] }
            ].map((plan, i) => (
              <div key={i} className={`glass-card p-8 relative flex flex-col ${plan.featured ? 'ring-2 ring-[var(--color-accent)] transform md:-translate-y-4' : ''}`}>
                {plan.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 badge-accent px-4 py-1">Most Popular</div>}
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <p className="text-[var(--color-text-secondary)] text-sm mb-6">{plan.desc}</p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-[var(--color-text-muted)]">/month</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm">
                      <span className="text-[var(--color-success)] mt-0.5">✓</span>
                      <span className="text-[var(--color-text-secondary)]">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className={plan.featured ? 'btn-primary w-full' : 'btn-secondary w-full'}>
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-12 text-center text-[var(--color-text-muted)]">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold text-[var(--color-text-primary)]">AI API Platform</span>
        </div>
        <p className="text-sm">© {new Date().getFullYear()} AI API Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}

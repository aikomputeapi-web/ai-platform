import Link from 'next/link';

export default function Docs() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
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
            <Link href="/features" className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors">Features</Link>
            <Link href="/docs" className="text-sm font-medium text-white transition-colors border-b-2 border-indigo-500 py-5">Docs</Link>
            <Link href="/login" className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors">Sign In</Link>
            <Link href="/signup" className="btn-primary py-2 px-4 text-sm">Get Started</Link>
          </nav>
        </div>
      </header>

      {/* Docs Content */}
      <main className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row gap-12">
        {/* Sidebar */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="sticky top-24">
            <h3 className="font-bold text-lg mb-4 text-[var(--color-text-primary)]">Documentation</h3>
            <ul className="space-y-3">
              <li><a href="#getting-started" className="text-[var(--color-accent)] font-medium hover:underline">Getting Started</a></li>
              <li><a href="#authentication" className="text-[var(--color-text-secondary)] hover:text-white transition-colors">Authentication</a></li>
              <li><a href="#making-requests" className="text-[var(--color-text-secondary)] hover:text-white transition-colors">Making Requests</a></li>
              <li><a href="#models" className="text-[var(--color-text-secondary)] hover:text-white transition-colors">Supported Models</a></li>
              <li><a href="#rate-limits" className="text-[var(--color-text-secondary)] hover:text-white transition-colors">Rate Limits</a></li>
            </ul>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 max-w-3xl animate-fade-in">
          <h1 className="text-4xl font-bold tracking-tight mb-4">API Documentation</h1>
          <p className="text-xl text-[var(--color-text-secondary)] mb-12">
            Learn how to integrate the AI API Platform into your application. Our API is highly compatible with the OpenAI SDK format.
          </p>

          <section id="getting-started" className="mb-16">
            <h2 className="text-2xl font-bold mb-6 border-b border-[var(--color-border)] pb-2">Getting Started</h2>
            <p className="text-[var(--color-text-secondary)] mb-6 leading-relaxed">
              To begin using our unified AI API, you first need to create an account and generate an API key. We provide a drop-in replacement for OpenAI, meaning you don't need to learn a new SDK.
            </p>
            
            <div className="glass-card p-6 mb-8 relative">
               <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none"></div>
               <h4 className="font-bold mb-3 text-white">1. Sign Up for an Account</h4>
               <p className="text-[var(--color-text-secondary)] mb-4">Go to our signup page and create your free account. No credit card is required to start testing.</p>
               <Link href="/signup" className="btn-secondary inline-block px-4 py-2 text-sm">Create Account</Link>
            </div>

            <div className="glass-card p-6 mb-8 relative">
               <h4 className="font-bold mb-3 text-white">2. Generate an API Key</h4>
               <p className="text-[var(--color-text-secondary)] mb-4">Once logged in, navigate to the Dashboard &gt; API Keys and create a new key. Keep this secret!</p>
               {/* Embed generated dashboard image */}
               <img src="/images/dashboard_demo_1776911661794.png" alt="Dashboard API Key Generation" className="w-full rounded-lg border border-[var(--color-border)] shadow-2xl" />
            </div>
          </section>

          <section id="authentication" className="mb-16">
            <h2 className="text-2xl font-bold mb-6 border-b border-[var(--color-border)] pb-2">Authentication</h2>
            <p className="text-[var(--color-text-secondary)] mb-4 leading-relaxed">
              Authenticate your API requests by providing your API key in the `Authorization` header. If you are using the OpenAI SDK, it will handle this automatically.
            </p>
            <div className="bg-[#0f0f13] border border-[var(--color-border)] rounded-xl p-4 overflow-x-auto">
              <pre className="text-sm font-mono text-gray-300">
                Authorization: Bearer <span className="text-green-400">YOUR_API_KEY</span>
              </pre>
            </div>
          </section>

          <section id="making-requests" className="mb-16">
            <h2 className="text-2xl font-bold mb-6 border-b border-[var(--color-border)] pb-2">Making Requests</h2>
            <p className="text-[var(--color-text-secondary)] mb-6 leading-relaxed">
              Since we map directly to the standard chat completions format, it is effortless to start making calls. Just change the base URL to our endpoint.
            </p>
            
            <img src="/images/api_code_demo_1776911689294.png" alt="API Request Code Editor" className="w-full rounded-lg border border-[var(--color-border)] shadow-2xl mb-6" />

            <div className="bg-[#0f0f13] border border-[var(--color-border)] rounded-xl p-4 overflow-x-auto">
              <pre className="text-sm font-mono text-gray-300">
                <span className="text-purple-400">import</span> OpenAI <span className="text-purple-400">from</span> <span className="text-green-400">'openai'</span>;<br/><br/>
                <span className="text-purple-400">const</span> client = <span className="text-purple-400">new</span> OpenAI(&#123;<br/>
                &nbsp;&nbsp;apiKey: <span className="text-green-400">'YOUR_API_KEY'</span>,<br/>
                &nbsp;&nbsp;baseURL: <span className="text-green-400">'https://api.yourdomain.com/v1'</span><br/>
                &#125;);<br/><br/>
                <span className="text-purple-400">const</span> response = <span className="text-purple-400">await</span> client.chat.completions.create(&#123;<br/>
                &nbsp;&nbsp;model: <span className="text-green-400">'claude-3-5-sonnet'</span>,<br/>
                &nbsp;&nbsp;messages: [&#123; role: <span className="text-green-400">'user'</span>, content: <span className="text-green-400">'Hello world'</span> &#125;]<br/>
                &#125;);
              </pre>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-12 text-center text-[var(--color-text-muted)]">
        <p className="text-sm">© {new Date().getFullYear()} AI API Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}

import Link from 'next/link';

const PROVIDERS = ['OPENAI', 'ANTHROPIC', 'GOOGLE', 'DEEPSEEK', 'XAI', 'META', 'MISTRAL', 'MOONSHOT'];

const FEATURES = [
  { num: '01', title: 'Unified Routing', desc: 'One API key routes to any model. Switch providers without changing your integration.' },
  { num: '02', title: 'Smart Fallbacks', desc: 'Automatic failover to the next best model when a provider is degraded or slow.' },
  { num: '03', title: 'Cost Control', desc: 'Set per-request budgets. Route to cheaper models when quality requirements allow.' },
  { num: '04', title: 'Model Access', desc: 'All Anthropic and OpenAI models, plus all the top open source models are included.' },
];

const PLANS = [
  { name: 'Pro', price: '$15', desc: 'Full model access, standard routing, community support.', highlight: false },
  { name: 'Max 5×', price: '$75', desc: 'Higher throughput, priority routing, email support.', highlight: true },
  { name: 'Max 20×', price: '$150', desc: 'Maximum capacity, dedicated routing, SLA guarantee.', highlight: false },
];

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav className="site-nav">
        <Link href="/" className="nav-brand">
          AI<span>KOMPUTE</span>
        </Link>
        <div className="nav-links">
          <Link href="/models">MODELS</Link>
          <Link href="/features">FEATURES</Link>
          <Link href="/pricing">PRICING</Link>
          <Link href="/docs">DOCS</Link>
        </div>
        <div className="nav-right">
          <Link href="/login" className="nav-signin">SIGN IN</Link>
          <Link href="/signup" className="nav-cta">START FREE →</Link>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-main">
          <div className="hero-tag">AI Infrastructure — v1.0</div>
          <div>
            <h1>
              ONE<br />
              <span className="outline">API.</span><br />
              <span className="highlight">ALL MODELS.</span>
            </h1>
            <p className="hero-desc">
              Route any AI request intelligently across every frontier model. One key,
              unified billing, automatic fallbacks — built for teams that ship.
            </p>
            <div className="hero-ctas">
              <Link href="/signup" className="btn-accent">START FREE →</Link>
              <Link href="/docs" className="btn-border">View Docs</Link>
            </div>
          </div>
          <div className="hero-bottom-tag">
            OpenAI · Anthropic · Google · DeepSeek · xAI · Meta · Mistral
          </div>
        </div>
        <div className="hero-side">
          <div className="hero-side-block">
            <div className="side-label">Live Models</div>
            <div>
              <div className="side-num">100<span className="unit">+</span></div>
              <div className="side-desc">Frontier models available via a single OpenAI-compatible endpoint.</div>
            </div>
          </div>
          <div className="hero-side-block">
            <div className="side-label">Avg. Latency</div>
            <div>
              <div className="side-num">&lt;50<span className="unit">ms</span></div>
              <div className="side-desc">Fastest path to the right model, every single request.</div>
            </div>
          </div>
          <div className="hero-side-block">
            <div className="side-label">Uptime SLA</div>
            <div>
              <div className="side-num">99<span className="unit">.99%</span></div>
              <div className="side-desc">Mission-critical reliability with automatic provider failover.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROVIDER TICKER ──────────────────────────────────────────────── */}
      <div className="compliance-bar">
        <div className="compliance-label">Compatible With</div>
        <div className="compliance-items">
          {[...PROVIDERS, ...PROVIDERS].map((p, i) => (
            <div key={i} className="compliance-item">
              <span className="dot">●</span>{p}
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURE GRID ─────────────────────────────────────────────────── */}
      <div className="feature-grid">
        {FEATURES.map(({ num, title, desc }) => (
          <div key={num} className="feat-cell">
            <span className="feat-num">{num}</span>
            <div className="feat-title">{title}</div>
            <p className="feat-desc">{desc}</p>
          </div>
        ))}
      </div>

      {/* ── QUICKSTART / CODE BLOCK ──────────────────────────────────────── */}
      <div className="feature-wide">
        <div className="feature-wide-text">
          <div className="eyebrow">QUICK START</div>
          <h2>Ship in<br />minutes.</h2>
          <p>
            Swap your baseURL, pass your API key, and you&apos;re live.
            Fully OpenAI-compatible — zero code changes required.
          </p>
          <Link href="/docs" className="btn-accent">READ THE DOCS →</Link>
        </div>
        <div className="feature-wide-code">
          <div className="terminal-window">
            <div className="terminal-header">
              <div className="tdot r"></div>
              <div className="tdot y"></div>
              <div className="tdot g"></div>
            </div>
            <div className="terminal-code">
              <div><span className="tc-prompt">$</span> <span className="tc-cmd">npm install openai</span></div>
              <div><span className="tc-out">+ openai@4.x ✓</span></div>
              <br />
              <div><span className="tc-comment">{`// No code changes — just update baseURL`}</span></div>
              <div><span className="tc-cmd">{`const client = new OpenAI({`}</span></div>
              <div>&nbsp;&nbsp;<span className="tc-cmd">apiKey: <span className="tc-out">&apos;ak-...&apos;</span>,</span></div>
              <div>&nbsp;&nbsp;<span className="tc-cmd">baseURL: <span className="tc-out">&apos;https://api.aikompute.com/v1&apos;</span></span></div>
              <div><span className="tc-cmd">{`});`}</span></div>
              <br />
              <div><span className="tc-prompt">$</span> <span className="tc-cmd">node index.js</span></div>
              <div><span className="tc-out">✓ Routed to claude-3-5-sonnet — 320ms</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      <div className="pricing-section">
        <div className="pricing-label">Pricing</div>
        <div className="pricing-grid">
          {PLANS.map(({ name, price, desc, highlight }) => (
            <div key={name} className={`pricing-card${highlight ? ' highlight' : ''}`}>
              <div className="pricing-name">{name}</div>
              <div className="pricing-amount">
                {price}
                <span className="period">/mo</span>
              </div>
              <p className="pricing-desc">{desc}</p>
              <Link
                href="/signup"
                className={highlight ? 'btn-accent' : 'btn-border'}
              >
                GET STARTED →
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA BANNER ───────────────────────────────────────────────────── */}
      <div className="cta-banner">
        <div className="cta-banner-text">
          <h2>Ready to go live?</h2>
          <p>Start building for free. No credit card required. Cancel anytime.</p>
        </div>
        <div className="cta-banner-action">
          <Link href="/signup" className="btn-dark">START FOR FREE →</Link>
        </div>
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="site-footer">
        <div className="footer-col">
          <div className="footer-brand">AI<span>KOMPUTE</span></div>
          <p className="footer-tagline">
            All Anthropic and OpenAI models, plus all the top open source models are included. Route intelligently, scale automatically.
          </p>
        </div>
        <div className="footer-col">
          <h5>Product</h5>
          <Link href="/models">Models</Link>
          <Link href="/features">Features</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/changelog">Changelog</Link>
        </div>
        <div className="footer-col">
          <h5>Developers</h5>
          <Link href="/docs">API Reference</Link>
          <Link href="/quickstart">Quickstart</Link>
          <Link href="/guides">Guides</Link>
        </div>
        <div className="footer-col">
          <h5>Company</h5>
          <Link href="/faq">FAQ</Link>
          <Link href="/support">Support</Link>
          <Link href="/status">Status</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </footer>
      <div className="footer-bottom">
        <span>© 2026 AIKOMPUTE INC.</span>
        <span>ALL ANTHROPIC &amp; OPENAI. PLUS TOP OPEN SOURCE.</span>
      </div>
    </div>
  );
}
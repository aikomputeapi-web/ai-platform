'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <>
      <footer className="site-footer">
        {/* Brand col */}
        <div className="footer-col">
          <div className="footer-brand">AI<span>KOMPUTE</span></div>
          <p className="footer-tagline">
            All Anthropic and OpenAI models, plus all the top open source models are included. Route intelligently across OpenAI, Anthropic, Google, and more.
          </p>
        </div>

        {/* Product */}
        <div className="footer-col">
          <h5>Product</h5>
          <Link href="/models">Models</Link>
          <Link href="/features">Features</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/changelog">Changelog</Link>
        </div>

        {/* Developers */}
        <div className="footer-col">
          <h5>Developers</h5>
          <Link href="/docs">API Reference</Link>
          <Link href="/quickstart">Quickstart</Link>
          <Link href="/guides">Integration Guides</Link>
          <Link href="/models">Model Catalogue</Link>
        </div>

        {/* Legal */}
        <div className="footer-col">
          <h5>Legal</h5>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/support">Support</Link>
        </div>
      </footer>

      {/* Footer bottom bar */}
      <div className="footer-bottom">
        <span>© 2026 AIKOMPUTE INC.</span>
        <span>ALL ANTHROPIC &amp; OPENAI. PLUS TOP OPEN SOURCE.</span>
      </div>
    </>
  );
}
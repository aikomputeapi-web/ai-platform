import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — AI API Platform',
  description: 'Privacy policy describing how AI API Platform collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      <header className="border-b border-[var(--color-border)] bg-[rgba(10,10,15,0.8)] backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <span className="font-bold text-sm">AI API Platform</span>
          </Link>
          <Link href="/login" className="text-sm text-[var(--color-text-secondary)] hover:text-white transition-colors">Sign In</Link>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-[var(--color-text-muted)] text-sm mb-12">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        {[
          { title: '1. Information We Collect', body: 'We collect information you provide directly: name, email address, and payment information (processed by Stripe — we never store raw card data). We also collect usage data including API request counts, token usage, model names, and timestamps to enable billing, analytics, and abuse prevention.' },
          { title: '2. How We Use Your Information', body: 'We use collected information to: (a) provide and operate the Service; (b) process payments and manage subscriptions; (c) send transactional emails (account verification, password reset, invoices); (d) monitor for abuse and enforce rate limits; (e) improve the Service through aggregated analytics.' },
          { title: '3. Request Content', body: 'We do not store the content of your AI requests or responses. API calls are proxied in real-time to underlying providers. Metadata (model, token count, latency) is retained for usage tracking and billing purposes only.' },
          { title: '4. Data Sharing', body: 'We do not sell your personal data. We share data only with: (a) Stripe for payment processing; (b) AI model providers (your API key and request are forwarded); (c) infrastructure providers (cloud hosting, CDN) under strict data processing agreements. We may disclose data if required by law.' },
          { title: '5. Data Retention', body: 'Account information is retained for the lifetime of your account plus 30 days after deletion. Usage logs are retained for 90 days. Payment records are retained for 7 years as required by applicable financial regulations.' },
          { title: '6. Security', body: 'We use industry-standard security practices including TLS encryption for all data in transit, bcrypt password hashing, and encrypted secret storage. API keys displayed in our dashboard are masked and only shown in full at creation time.' },
          { title: '7. Your Rights', body: 'Depending on your jurisdiction, you may have rights to access, correct, or delete your personal data. To exercise these rights, contact us via the email on file. We will respond within 30 days. You may delete your account at any time from the dashboard settings page.' },
          { title: '8. Cookies', body: 'We use a single HTTP-only session cookie ("portal_session") for authentication. We do not use tracking cookies or third-party analytics cookies.' },
          { title: '9. Children', body: 'The Service is not directed to persons under 18 years of age. We do not knowingly collect personal information from minors.' },
          { title: '10. Changes', body: 'We will notify you of material changes to this Privacy Policy via email at least 7 days before they take effect. Continued use of the Service after the effective date constitutes acceptance.' },
          { title: '11. Contact Us', body: 'For privacy inquiries, data deletion requests, or to exercise your rights, please contact us through our website.' },
        ].map((section, i) => (
          <section key={i} className="mb-8">
            <h2 className="text-lg font-semibold mb-3 text-[var(--color-text-primary)]">{section.title}</h2>
            <p className="text-[var(--color-text-secondary)] leading-relaxed">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

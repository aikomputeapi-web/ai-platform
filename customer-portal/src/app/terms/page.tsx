import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — AI API Platform',
  description: 'Terms of service governing use of the AI API Platform.',
};

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-[var(--color-text-muted)] text-sm mb-12">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        {[
          { title: '1. Acceptance of Terms', body: 'By accessing or using the AI API Platform ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the Service.' },
          { title: '2. Description of Service', body: 'AI API Platform provides a unified proxy API that routes requests to various artificial intelligence model providers. We offer free and paid subscription tiers as described on our pricing page.' },
          { title: '3. Account Registration', body: 'You must provide accurate information when registering. You are responsible for maintaining the confidentiality of your account credentials and all activity under your account. You must be at least 18 years old to use this Service.' },
          { title: '4. API Keys and Usage', body: 'API keys issued to you are for your personal or business use only and may not be shared, resold, or redistributed. You are responsible for all usage incurred under your API keys. We reserve the right to suspend or terminate keys that violate these terms.' },
          { title: '5. Acceptable Use', body: 'You may not use the Service to: (a) violate any applicable law or regulation; (b) generate illegal, abusive, harmful, or misleading content; (c) attempt to circumvent rate limits through multiple accounts; (d) reverse-engineer, resell, or redistribute the Service itself; (e) conduct any activity that could damage, disable, or impair the Service.' },
          { title: '6. Rate Limits and Quotas', body: 'Each subscription plan includes specific rate limits and daily quotas as described on the pricing page. Exceeding these limits will result in request throttling. We reserve the right to adjust limits to ensure fair use for all customers.' },
          { title: '7. Payment and Billing', body: 'Paid plans are billed monthly in advance. Subscriptions automatically renew unless cancelled. Refunds are not available for partial billing periods. All prices are in USD and exclude any applicable taxes.' },
          { title: '8. Service Availability', body: 'We strive for high availability but do not guarantee uninterrupted service. We are not liable for downtime of underlying AI providers. Our SLA for paid plans targets 99% uptime calculated monthly.' },
          { title: '9. Intellectual Property', body: 'The Service and its original content remain the exclusive property of AI API Platform. Your use of the Service does not grant you ownership of any intellectual property rights in the Service or its content.' },
          { title: '10. Limitation of Liability', body: 'To the fullest extent permitted by law, AI API Platform shall not be liable for any indirect, incidental, special, or consequential damages resulting from your use of the Service, including but not limited to loss of profits, data, or business.' },
          { title: '11. Changes to Terms', body: 'We reserve the right to modify these terms at any time. We will notify users of material changes by email or through a prominent notice on our website. Continued use of the Service after changes constitutes acceptance.' },
          { title: '12. Contact', body: 'For questions about these terms, please contact us through our website.' },
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

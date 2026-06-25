import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Terms of Service — aikompute',
  description: 'Terms of service governing use of aikompute.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-[var(--color-text-primary)] font-mono">
      <Header />
      
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-extrabold text-white font-display mb-2">[Terms of Service]</h1>
        <p className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider font-bold mb-12">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        {[
          { title: '1. Acceptance of Terms', body: 'By accessing or using aikompute ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the Service.' },
          { title: '2. Description of Service', body: 'aikompute provides a unified proxy API that routes requests to various artificial intelligence model providers. We offer free and paid subscription tiers as described on our pricing page.' },
          { title: '3. Account Registration', body: 'You must provide accurate information when registering. You are responsible for maintaining the confidentiality of your account credentials and all activity under your account. You must be at least 18 years old to use this Service.' },
          { title: '4. API Keys and Usage', body: 'API keys issued to you are for your personal or business use only and may not be shared, resold, or redistributed. You are responsible for all usage incurred under your API keys. We reserve the right to suspend or terminate keys that violate these terms.' },
          { title: '5. Subscription Scope and Personal Use', body: 'Subscription plans are strictly for a single individual. Under no circumstances are subscriptions allowed to be shared among multiple users. Subscriptions are intended solely for personal use, specifically coding and software development. They are not allowed to be used in production services of any kind. Any alternative use cases, such as role-playing, entertainment, or AI friendship applications, are strictly prohibited.' },
          { title: '6. Acceptable Use', body: 'You may not use the Service to: (a) violate any applicable law or regulation; (b) generate illegal, abusive, harmful, or misleading content; (c) attempt to circumvent rate limits through multiple accounts; (d) reverse-engineer, resell, or redistribute the Service itself; (e) conduct any activity that could damage, disable, or impair the Service.' },
          { title: '7. Quotas and Limits', body: 'Each subscription plan includes specific quotas as described on the pricing page. Exceeding these limits will result in request throttling. We reserve the right to adjust limits to ensure fair use for all customers.' },
          { title: '8. Payment and Billing', body: 'Paid plans are billed monthly in advance. Subscriptions automatically renew unless cancelled. Refunds are not available for partial billing periods. All prices are in USD and exclude any applicable taxes.' },
          { title: '9. Service Availability', body: 'We strive for high availability but do not guarantee uninterrupted service. We are not liable for downtime of underlying AI providers. Our SLA for paid plans targets 99% uptime calculated monthly.' },
          { title: '10. Intellectual Property', body: 'The Service and its original content remain the exclusive property of aikompute. Your use of the Service does not grant you ownership of any intellectual property rights in the Service or its content.' },
          { title: '11. Limitation of Liability', body: 'To the fullest extent permitted by law, aikompute shall not be liable for any indirect, incidental, special, or consequential damages resulting from your use of the Service, including but not limited to loss of profits, data, or business.' },
          { title: '12. Changes to Terms', body: 'We reserve the right to modify these terms at any time. We will notify users of material changes by email or through a prominent notice on our website. Continued use of the Service after changes constitutes acceptance.' },
          { title: '13. Contact', body: 'For questions about these terms, please contact us through our website.' },
        ].map((section, i) => (
          <section key={i} className="mb-8 border-l border-white/10 pl-4 py-1">
            <h2 className="text-xs font-bold mb-2 uppercase text-white font-display">{section.title}</h2>
            <p className="text-[10px] text-[var(--color-text-secondary)] leading-relaxed font-medium">{section.body}</p>
          </section>
        ))}
      </div>

      <Footer />
    </div>
  );
}

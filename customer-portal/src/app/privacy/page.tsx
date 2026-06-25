import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Privacy Policy — aikompute',
  description: 'Privacy policy describing how aikompute collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-[var(--color-text-primary)] font-mono">
      <Header />
      
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-extrabold text-white font-display mb-2">[Privacy Policy]</h1>
        <p className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider font-bold mb-12">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        {[
          { title: '1. Information We Collect', body: 'We collect the information you provide directly, such as your name, email address, and payment details processed by Stripe. We do not store raw card data, and we do not store request content, model outputs, or other AI conversation data.' },
          { title: '2. How We Use Your Information', body: 'We use collected information to: (a) provide and operate the Service; (b) process payments and manage subscriptions; and (c) send transactional emails such as account verification, password reset, and invoices.' },
          { title: '3. Request Content', body: 'We do not store the content of your AI requests or responses. API calls are proxied in real-time to underlying providers.' },
          { title: '4. Data Sharing and Model Training', body: 'We do not sell, resell, or share your data with third parties, and we do not use your data to train our own models.' },
          { title: '5. Data Retention', body: 'We do not retain request content or model outputs. Account and billing records are retained only as needed to operate the Service and satisfy legal requirements.' },
          { title: '6. Security', body: 'We use industry-standard security practices including TLS encryption for all data in transit, bcrypt password hashing, and encrypted secret storage. API keys displayed in our dashboard are masked and only shown in full at creation time.' },
          { title: '7. Your Rights', body: 'Depending on your jurisdiction, you may have rights to access, correct, or delete your personal data. To exercise these rights, contact us via the email on file. We will respond within 30 days. You may delete your account at any time from the dashboard settings page.' },
          { title: '8. Cookies', body: 'We use a single HTTP-only session cookie ("portal_session") for authentication. We do not use tracking cookies or third-party analytics cookies.' },
          { title: '9. Children', body: 'The Service is not directed to persons under 18 years of age. We do not knowingly collect personal information from minors.' },
          { title: '10. Changes', body: 'We will notify you of material changes to this Privacy Policy via email at least 7 days before they take effect. Continued use of the Service after the effective date constitutes acceptance.' },
          { title: '11. Contact Us', body: 'For privacy inquiries, data deletion requests, or to exercise your rights, please contact us through our website.' },
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

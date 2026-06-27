import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Privacy Policy — AIKOMPUTE',
  description: 'Privacy policy describing how AIKOMPUTE collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <div className="page-shell">
      <Header />
      
      <div className="page-hero">
        <div className="hero-tag mb-16">LEGAL</div>
        <h1 className="heading-hero">
          Privacy Policy
        </h1>
        <p className="hero-desc text-max-480">
          Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="page-content flex flex-col gap-32" style={{ maxWidth: '800px' }}>
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
          <section key={i} className="flex-1" style={{ borderLeft: '1px solid var(--accent)', paddingLeft: '24px' }}>
            <h2 className="mono text-13 font-700 uppercase text-bright mb-8">{section.title}</h2>
            <p className="text-14 text-muted" style={{ lineHeight: 1.7 }}>{section.body}</p>
          </section>
        ))}
      </div>

      <Footer />
    </div>
  );
}

import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const capabilities = [
  { number: '01', title: 'One endpoint. Every model.', text: 'Keep your OpenAI-compatible integration. Change models with one parameter, not a rewrite.' },
  { number: '02', title: 'Routing with a safety net.', text: 'Route requests across providers and configure fallbacks for the moments a model is unavailable.' },
  { number: '03', title: 'A clear view of usage.', text: 'Manage keys, requests and subscription details from one place built for people shipping with AI.' },
];

const providers = ['OpenAI', 'Anthropic', 'Google', 'DeepSeek', 'xAI', 'Meta', 'Mistral', 'Moonshot'];

export default function Home() {
  return (
    <main className="helios-page">
      <Header />
      <section className="helios-hero">
        <div className="helios-orbit helios-orbit-one" aria-hidden="true" />
        <div className="helios-orbit helios-orbit-two" aria-hidden="true" />
        <div className="helios-hero-copy">
          <div className="helios-kicker"><span /> A NEW PERSPECTIVE ON AI INFRASTRUCTURE</div>
          <h1>All the<br />intelligence.<br /><em>One connection.</em></h1>
          <p className="helios-lede">Bring the world’s models into your product through one beautifully simple API.</p>
          <div className="helios-actions">
            <Link href="/signup" className="helios-button">Get your API key <span aria-hidden="true">↗</span></Link>
            <Link href="/quickstart" className="helios-text-link">See the integration <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="helios-proof">YOUR SDK. YOUR MODELS. YOUR NEXT BIG IDEA.</div>
        </div>
        <div className="helios-artwork" role="img" aria-label="Golden torus sculpture representing one connection across many AI models">
          <div className="helios-figure-label">FIG. 01 — THE CONNECTION LAYER</div>
          <div className="helios-torus"><div /></div>
          <div className="helios-artwork-caption"><span>Many models.</span><span>One point of possibility.</span></div>
        </div>
      </section>

      <section className="helios-marquee" aria-label="Supported AI providers">
        <span>ONE CONNECTION, A WORLD OF MODELS</span>
        <div>{providers.map((provider) => <span key={provider}>{provider}</span>)}</div>
      </section>

      <section className="helios-intro">
        <div className="helios-section-tag">A BETTER WAY THROUGH</div>
        <div><h2>Build on what’s next.<br /><em>Stay in control.</em></h2><p>AIKompute gives your team a clean path to the models you want, with the tools to change direction whenever the work calls for it.</p></div>
      </section>

      <section className="helios-capabilities">
        {capabilities.map((item) => <article key={item.number} className="helios-capability"><span>{item.number}</span><div><h3>{item.title}</h3><p>{item.text}</p></div><span className="helios-capability-arrow" aria-hidden="true">↗</span></article>)}
      </section>

      <section className="helios-bottom-cta">
        <div className="helios-bottom-glow" aria-hidden="true" />
        <div className="helios-section-tag">YOUR NEXT BUILD STARTS HERE</div>
        <h2>Let good ideas<br /><em>see the light.</em></h2>
        <p>Start on the free plan. Bring your favorite tools. See what you can make.</p>
        <Link href="/signup" className="helios-button">Create your account <span aria-hidden="true">↗</span></Link>
      </section>
      <Footer />
    </main>
  );
}

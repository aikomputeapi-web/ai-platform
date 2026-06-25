import Link from 'next/link';
import { MODELS } from '@/lib/models';

const MODELS_TABLE = [
  [MODELS.OPENAI_FLAGSHIP,  MODELS.OPENAI_FLAGSHIP_ID,  'OpenAI'],
  [MODELS.ANTHROPIC_OPUS,   MODELS.ANTHROPIC_OPUS_ID,   'Anthropic'],
  [MODELS.ANTHROPIC_SONNET, MODELS.ANTHROPIC_SONNET_ID, 'Anthropic'],
  [MODELS.GOOGLE_PRO,       MODELS.GOOGLE_PRO_ID,       'Google'],
  [MODELS.GOOGLE_FLASH,     MODELS.GOOGLE_FLASH_ID,     'Google'],
  [MODELS.DEEPSEEK_V3,      MODELS.DEEPSEEK_V3_ID,      'DeepSeek'],
];

export default function Docs() {
  return (
    <div className="min-h-screen bg-black font-mono flex flex-col">
      <nav className="flex items-center justify-between max-w-3xl mx-auto w-full px-6 py-5 text-xs">
        <Link href="/" className="text-white">◇ aikompute</Link>
        <div className="flex items-center gap-5" style={{ color: 'var(--color-grey)' }}>
          <Link href="/models" className="hover:text-white">Models</Link>
          <Link href="/features" className="hover:text-white">Features</Link>
          <span className="text-white">Docs</span>
          <Link href="/login" className="hover:text-white">Sign in</Link>
          <Link href="/signup" className="btn-outline">Register</Link>
        </div>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pb-20">
        <section className="py-14">
          <h1 className="text-4xl font-light tracking-tight text-white">Docs</h1>
        </section>

        <section className="pb-10">
          <div className="text-xs uppercase tracking-wider pb-3" style={{ color: 'var(--color-grey-dim)', borderBottom: '1px solid var(--color-border)' }}>Getting Started</div>
          <p className="mt-4 text-xs leading-relaxed" style={{ color: 'var(--color-grey)' }}>
            Swap your baseURL to <code className="text-white">https://api.yourdomain.com/v1</code> and pass your API key in the Authorization header.
          </p>
          <div className="card p-4 mt-4 font-mono text-xs" style={{ background: '#000' }}>
            Authorization: Bearer YOUR_API_KEY
          </div>
        </section>

        <section className="pb-10">
          <div className="text-xs uppercase tracking-wider pb-3" style={{ color: 'var(--color-grey-dim)', borderBottom: '1px solid var(--color-border)' }}>Example</div>
          <div className="card p-4 mt-4 font-mono text-xs leading-relaxed" style={{ background: '#000', color: 'var(--color-grey)' }}>
            <span className="text-white">const</span> client = <span className="text-white">new</span> OpenAI({`{`}<br />
            &nbsp;&nbsp;apiKey: 'YOUR_API_KEY',<br />
            &nbsp;&nbsp;baseURL: 'https://api.yourdomain.com/v1'<br />
            {`}`});<br /><br />
            <span className="text-white">const</span> res = <span className="text-white">await</span> client.chat.completions.create({`{`}<br />
            &nbsp;&nbsp;model: 'claude-3-5-sonnet',<br />
            &nbsp;&nbsp;messages: [{`{`} role: 'user', content: 'hi' {`}`}]<br />
            {`}`});
          </div>
        </section>

        <section className="pb-10">
          <div className="text-xs uppercase tracking-wider pb-3" style={{ color: 'var(--color-grey-dim)', borderBottom: '1px solid var(--color-border)' }}>Models</div>
          <div className="card mt-4" style={{ background: '#000' }}>
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-grey-dim)' }}>
                  <th className="p-3 font-normal text-left">Model</th>
                  <th className="p-3 font-normal text-left">API ID</th>
                  <th className="p-3 font-normal text-left">Provider</th>
                </tr>
              </thead>
              <tbody>
                {MODELS_TABLE.map(([name, id, provider], i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.02)', color: 'var(--color-grey)' }}>
                    <td className="p-3 text-white">{name}</td>
                    <td className="p-3 font-mono">{id}</td>
                    <td className="p-3">{provider}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="max-w-3xl mx-auto w-full px-6 py-6 border-t text-[10px]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-grey-dim)' }}>
        <div className="flex justify-between">
          <span>© 2026</span>
          <div className="flex gap-5">
            <Link href="/docs" className="hover:text-white">Docs</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const STEPS = [
  {
    num: '01',
    title: 'Create an account',
    desc: "Sign up for free — no credit card required. You'll get 50 free requests to start.",
    code: null,
  },
  {
    num: '02',
    title: 'Get your API key',
    desc: 'Once logged in, generate an API key from the dashboard. Your key starts with "sk-".',
    code: '# Navigate to Dashboard → API Keys → Create Key',
  },
  {
    num: '03',
    title: 'Make your first request',
    desc: 'Use your API key with any OpenAI-compatible client. Just swap the baseURL.',
    code: `curl -X POST https://api.aikompute.com/v1/chat/completions \\
  -H "Authorization: Bearer API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [
      {"role": "user", "content": "Hello, world!"}
    ]
  }'`,
  },
  {
    num: '04',
    title: 'Monitor your usage',
    desc: 'Track requests, tokens, and costs in real-time from your dashboard.',
    code: null,
  },
];

const SNIPPETS = [
  {
    lang: 'Python',
    code: `from openai import OpenAI

client = OpenAI(
  api_key="API_KEY",
  base_url="https://api.aikompute.com/v1"
)

response = client.chat.completions.create(
  model="claude-sonnet-4-5",
  messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`,
  },
  {
    lang: 'Node.js',
    code: `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'API_KEY',
  baseURL: 'https://api.aikompute.com/v1',
});

const res = await client.chat.completions.create({
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(res.choices[0].message.content);`,
  },
  {
    lang: 'cURL',
    code: `curl -X POST https://api.aikompute.com/v1/chat/completions \\
  -H "Authorization: Bearer API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
  },
  {
    lang: 'Go',
    code: `package main

import (
  "bytes"
  "encoding/json"
  "fmt"
  "net/http"
)

func main() {
  body, _ := json.Marshal(map[string]any{
    "model": "claude-sonnet-4-5",
    "messages": []map[string]string{
      {"role": "user", "content": "Hello!"},
    },
  })
  req, _ := http.NewRequest("POST",
    "https://api.aikompute.com/v1/chat/completions",
    bytes.NewReader(body))
  req.Header.Set("Authorization", "Bearer API_KEY")
  req.Header.Set("Content-Type", "application/json")
  // send request...
}`,
  },
];

export default function QuickstartPage() {
  return (
    <div className="page-shell">
      <Header />

      <div className="page-hero">
        <div className="hero-tag mb-16">QUICKSTART</div>
        <h1 className="heading-hero">
          Ship in 5 minutes.
        </h1>
        <p className="hero-desc text-max-600">
          From zero to your first API call. Fully OpenAI-compatible — no new SDKs, no code changes.
        </p>
      </div>

      {STEPS.map((step) => (
        <div key={step.num} className="border-bottom">
          <div className="page-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '48px' }}>
            <div>
              <div className="mono text-40 font-700" style={{ letterSpacing: '-0.04em', color: 'var(--border-bright)', lineHeight: 1, marginBottom: '16px' }}>{step.num}</div>
              <h2 className="text-20 font-600 mb-12 uppercase" style={{ letterSpacing: '0.02em' }}>{step.title}</h2>
              <p className="text-14 text-muted" style={{ lineHeight: 1.7 }}>{step.desc}</p>
            </div>
            <div>
              {step.code && (
                <div className="terminal-window">
                  <div className="terminal-header">
                    <div className="tdot r" />
                    <div className="tdot y" />
                    <div className="tdot g" />
                  </div>
                  <pre className="terminal-code bg-surface" style={{ margin: 0, overflowX: 'auto' }}>{step.code}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      <div className="page-section">
        <div className="mono text-10 uppercase text-muted mb-24" style={{ letterSpacing: '0.12em' }}>
          CODE EXAMPLES
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1px', background: 'var(--border-bright)' }}>
          {SNIPPETS.map(({ lang, code }) => (
            <div key={lang} className="bg-bg border-default">
              <div className="mono text-10 uppercase text-accent bg-surface" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-bright)', letterSpacing: '0.1em' }}>{lang}</div>
              <pre className="mono bg-bg" style={{ padding: '16px', fontSize: '11px', lineHeight: 1.8, color: 'var(--text)', overflowX: 'auto', margin: 0 }}>{code}</pre>
            </div>
          ))}
        </div>
      </div>

      <div className="page-section-sm flex-center gap-24 flex-wrap">
        <span className="mono text-13 text-muted">NEXT STEPS:</span>
        <Link href="/docs" className="btn-outline btn-sm">API Reference</Link>
        <Link href="/guides" className="btn-outline btn-sm">Integration Guides</Link>
        <Link href="/pricing" className="btn-outline btn-sm">Pricing</Link>
      </div>

      <Footer />
    </div>
  );
}

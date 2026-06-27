'use client';

import Link from 'next/link';

function NavBar({ active }: { active?: string }) {
  return (
    <nav className="site-nav">
      <Link href="/" className="nav-brand">
        AIKO<span>MPUTE</span>
      </Link>
      <div className="nav-links">
        {[
          { href: '/models', label: 'MODELS' },
          { href: '/features', label: 'FEATURES' },
          { href: '/pricing', label: 'PRICING' },
          { href: '/docs', label: 'DOCS' },
        ].map(({ href, label }) => (
          <Link key={href} href={href} style={label === 'DOCS' ? { color: 'var(--accent)' } : undefined}>
            {label}
          </Link>
        ))}
      </div>
      <div className="nav-right">
        <Link href="/login" className="nav-signin">SIGN IN</Link>
        <Link href="/signup" className="nav-cta">START FREE →</Link>
      </div>
    </nav>
  );
}

const SECTIONS = [
  { id: 'auth', label: 'Authentication' },
  { id: 'chat', label: 'Chat Completions' },
  { id: 'streaming', label: 'Streaming' },
  { id: 'models', label: 'List Models' },
  { id: 'messages', label: 'Messages API' },
  { id: 'errors', label: 'Error Codes' },
  { id: 'rate-limits', label: 'Rate Limits' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'models-ref', label: 'Model Reference' },
];

const SNIPPETS_PYTHON = `from openai import OpenAI

client = OpenAI(
    api_key="ork_YOUR_API_KEY",
    base_url="https://api.aikompute.com/v1"
)

response = client.chat.completions.create(
    model="claude-sonnet-4-5",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`;

export default function DocsPage() {
  return (
    <div className="bg-bg" style={{ minHeight: '100vh', color: 'var(--text)' }}>
      <NavBar active="DOCS" />

      <div className="flex">
        {/* Sidebar */}
        <div className="dash-sidebar">
          <div className="dash-sidebar-label">API Reference</div>
          <div className="flex flex-col gap-4" style={{ padding: '16px 24px' }}>
            {SECTIONS.map(({ id, label }) => (
              <a key={id} href={`#${id}`} className="mono text-12 text-muted no-underline" style={{
                padding: '6px 0', transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--accent)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--muted)'}>
                {label}
              </a>
            ))}
          </div>
          <div className="mt-16" style={{ padding: '0 24px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <div className="mono text-10 uppercase text-muted mb-12" style={{ letterSpacing: '0.1em' }}>More</div>
            <Link href="/quickstart" className="mono text-11 text-muted block no-underline" style={{ padding: '4px 0' }}>Quickstart →</Link>
            <Link href="/guides" className="mono text-11 text-muted block no-underline" style={{ padding: '4px 0' }}>Integration Guides →</Link>
            <Link href="/changelog" className="mono text-11 text-muted block no-underline" style={{ padding: '4px 0' }}>Changelog →</Link>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div style={{ padding: '48px 64px 32px', borderBottom: '1px solid var(--border-bright)' }}>
            <div className="mono text-10 uppercase text-accent mb-12" style={{ letterSpacing: '0.15em' }}>● API REFERENCE</div>
            <h1 className="uppercase font-700 lh-1 mb-12" style={{ fontSize: 'clamp(28px, 3vw, 48px)', letterSpacing: '-0.03em' }}>
              API Reference
            </h1>
            <p className="text-muted text-14" style={{ maxWidth: '600px' }}>
              Fully OpenAI-compatible REST API. Swap your baseURL to <code className="mono text-12 text-accent">https://api.aikompute.com/v1</code> and you&apos;re live.
            </p>
          </div>

          {/* Getting Started */}
          <div className="docs-section">
            <div className="docs-eyebrow">Base URL</div>
            <code className="endpoint-badge block" style={{ marginBottom: '20px' }}>
              https://api.aikompute.com/v1
            </code>
            <p className="p-muted">
              All API requests require authentication via the <code className="mono text-12 text-bright">Authorization: Bearer</code> header. Pass your API key from the dashboard.
            </p>
          </div>

          {/* Authentication */}
          <div className="docs-section">
            <div className="docs-eyebrow">Authentication</div>
            <h2 className="text-20 font-600 mb-16">Authorization</h2>
            <p className="p-muted mb-16">
              Include your API key in the Authorization header. Keys are generated from the dashboard and start with <code className="mono text-12 text-bright">ork_</code>.
            </p>
            <div className="dash-code text-13">
              <span className="text-accent">Authorization:</span> Bearer ork_YOUR_API_KEY
            </div>
          </div>

          {/* Chat Completions */}
          <div className="docs-section">
            <div className="docs-eyebrow">Endpoint</div>
            <h2 className="text-20 font-600 mb-8">Chat Completions</h2>
            <code className="endpoint-badge" style={{ marginBottom: '20px' }}>
              POST /v1/chat/completions
            </code>

            <h3 className="text-13 font-600 mb-8 mt-16">Request Body</h3>
            <div className="border-bright overflow-hidden" style={{ marginBottom: '20px' }}>
              <table className="dash-table">
                <thead>
                  <tr className="bg-surface">
                    <th>Parameter</th>
                    <th>Type</th>
                    <th>Required</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['model', 'string', 'Yes', 'Model ID to use (e.g. claude-sonnet-4-5, gpt-4o)'],
                    ['messages', 'array', 'Yes', 'Array of message objects with role and content'],
                    ['stream', 'boolean', 'No', 'If true, sends SSE streaming responses'],
                    ['max_tokens', 'integer', 'No', 'Maximum tokens in the response'],
                    ['temperature', 'number', 'No', 'Sampling temperature (0-2). Defaults to 1'],
                    ['top_p', 'number', 'No', 'Nucleus sampling parameter'],
                    ['stop', 'string/array', 'No', 'Sequences where generation stops'],
                    ['frequency_penalty', 'number', 'No', 'Penalizes frequent tokens (-2 to 2)'],
                    ['presence_penalty', 'number', 'No', 'Penalizes repeated topics (-2 to 2)'],
                    ['user', 'string', 'No', 'End-user identifier for monitoring'],
                  ].map(([param, type, required, desc]) => (
                    <tr key={param}>
                      <td className="mono text-12">{param}</td>
                      <td className="mono text-12 text-muted">{type}</td>
                      <td className="mono text-12" style={{ color: required === 'Yes' ? 'var(--accent)' : 'var(--muted)' }}>{required}</td>
                      <td className="text-12 text-muted">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="text-13 font-600 mb-8">Example Request</h3>
            <div className="bg-surface border-bright overflow-hidden" style={{ marginBottom: '20px' }}>
              <div className="flex-center gap-6" style={{ background: 'var(--border)', padding: '8px 12px', borderBottom: '1px solid var(--border-bright)' }}>
                <div className="tdot r" />
                <div className="tdot y" />
                <div className="tdot g" />
              </div>
              <pre className="mono text-12 text-muted overflow-x-auto" style={{ padding: '16px', lineHeight: 1.8, margin: 0 }}>{`curl -X POST https://api.aikompute.com/v1/chat/completions \\
  -H "Authorization: Bearer ork_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What is the capital of France?"}
    ],
    "stream": false
  }'`}</pre>
            </div>

            <h3 className="text-13 font-600 mb-8">Example Response</h3>
            <div className="bg-surface border-bright overflow-hidden" style={{ marginBottom: '16px' }}>
              <pre className="mono text-12 text-muted overflow-x-auto" style={{ padding: '16px', lineHeight: 1.8, margin: 0 }}>{`{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1728000000,
  "model": "claude-sonnet-4-5",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The capital of France is Paris."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 18,
    "completion_tokens": 8,
    "total_tokens": 26
  }
}`}</pre>
            </div>
          </div>

          {/* Streaming */}
          <div className="docs-section">
            <div className="docs-eyebrow">SSE</div>
            <h2 className="text-20 font-600 mb-16">Streaming</h2>
            <p className="p-muted mb-16">
              Set <code className="mono text-12 text-bright">stream: true</code> to receive server-sent events (SSE). Each chunk contains a delta of the response.
            </p>
            <div className="bg-surface border-bright overflow-hidden">
              <pre className="mono text-12 text-muted overflow-x-auto" style={{ padding: '16px', lineHeight: 1.8, margin: 0 }}>{`data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"The"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" capital"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" of"},"finish_reason":null}]}

...

data: [DONE]`}</pre>
            </div>
          </div>

          {/* List Models */}
          <div className="docs-section">
            <div className="docs-eyebrow">Endpoint</div>
            <h2 className="text-20 font-600 mb-8">List Models</h2>
            <code className="endpoint-badge mb-16">
              GET /v1/models
            </code>
            <p className="p-muted mb-16">
              Returns a list of all available models. View the <Link href="/models" className="text-accent no-underline">live catalog</Link> for performance metrics and pricing.
            </p>
            <div className="bg-surface border-bright overflow-hidden">
              <pre className="mono text-12 text-muted overflow-x-auto" style={{ padding: '16px', lineHeight: 1.8, margin: 0 }}>{`curl -H "Authorization: Bearer ork_YOUR_API_KEY" \\
  https://api.aikompute.com/v1/models`}</pre>
            </div>
          </div>

          {/* Messages API */}
          <div className="docs-section">
            <div className="docs-eyebrow">Endpoint</div>
            <h2 className="text-20 font-600 mb-8">Messages API</h2>
            <code className="endpoint-badge mb-16">
              POST /v1/messages
            </code>
            <p className="p-muted mb-16">
              Anthropic-compatible messages endpoint. Works with the Anthropic SDKs — just swap the base URL.
            </p>
            <div className="bg-surface border-bright overflow-hidden">
              <pre className="mono text-12 text-muted overflow-x-auto" style={{ padding: '16px', lineHeight: 1.8, margin: 0 }}>{`curl -X POST https://api.aikompute.com/v1/messages \\
  -H "Authorization: Bearer ork_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{
    "model": "claude-sonnet-4-5",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello, Claude!"}
    ]
  }'`}</pre>
            </div>
          </div>

          {/* Error Codes */}
          <div className="docs-section">
            <div className="docs-eyebrow">Reference</div>
            <h2 className="text-20 font-600 mb-16">Error Codes</h2>
            <div className="border-bright overflow-hidden">
              <table className="dash-table">
                <thead>
                  <tr className="bg-surface">
                    <th>Status</th>
                    <th>Error Type</th>
                    <th>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['400', 'invalid_request_error', 'Malformed request body or missing required fields'],
                    ['401', 'authentication_error', 'Invalid, missing, or revoked API key'],
                    ['403', 'permission_error', 'API key does not have access to the requested model'],
                    ['404', 'not_found', 'The requested endpoint or model does not exist'],
                    ['429', 'rate_limit_error', 'Rate limit exceeded. Retry after the specified time'],
                    ['500', 'api_error', 'Internal server error. Contact support if persistent'],
                    ['502', 'provider_error', 'Upstream AI provider returned an error. Falls back automatically'],
                    ['503', 'overloaded', 'All providers are overloaded or degraded. Retry later'],
                  ].map(([status, type, meaning]) => (
                    <tr key={type}>
                      <td className="mono text-12 text-accent">{status}</td>
                      <td className="mono text-12">{type}</td>
                      <td className="text-12 text-muted">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rate Limits */}
          <div className="docs-section">
            <div className="docs-eyebrow">Limits</div>
            <h2 className="text-20 font-600 mb-16">Rate Limits</h2>
            <p className="p-muted mb-16">
              Rate limits vary by subscription plan. Exceeding your limit returns a <code className="mono text-12 text-bright">429</code> response with a <code className="mono text-12 text-bright">Retry-After</code> header.
            </p>
            <div className="border-bright overflow-hidden">
              <table className="dash-table">
                <thead>
                  <tr className="bg-surface">
                    <th>Plan</th>
                    <th>Requests/min</th>
                    <th>Daily Cap</th>
                    <th>Monthly Cap</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Free', '10', '500', '50'],
                    ['Pro', '60', '10,000', '300,000'],
                    ['Max 5x', '300', '100,000', '3,000,000'],
                    ['Max 20x', '1000', '500,000', '15,000,000'],
                  ].map(([plan, rpm, daily, monthly]) => (
                    <tr key={plan}>
                      <td className="mono text-12">{plan}</td>
                      <td className="mono text-12 text-muted">{rpm}</td>
                      <td className="mono text-12 text-muted">{daily}</td>
                      <td className="mono text-12 text-muted">{monthly}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-12 text-12 text-muted">
              Response headers include <code className="mono text-11 text-bright">X-RateLimit-Limit</code>, <code className="mono text-11 text-bright">X-RateLimit-Remaining</code>, and <code className="mono text-11 text-bright">X-RateLimit-Reset</code>.
            </p>
          </div>

          {/* Webhooks */}
          <div className="docs-section">
            <div className="docs-eyebrow">Events</div>
            <h2 className="text-20 font-600 mb-16">Webhooks</h2>
            <p className="p-muted mb-16">
              aikompute sends webhook events to your configured endpoint for billing and account events. Configure webhooks in your dashboard settings.
            </p>
            <div className="border-bright overflow-hidden" style={{ marginBottom: '16px' }}>
              <table className="dash-table">
                <thead>
                  <tr className="bg-surface">
                    <th>Event</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['checkout.session.completed', 'A subscription checkout succeeded'],
                    ['customer.subscription.updated', 'Subscription plan or status changed'],
                    ['customer.subscription.deleted', 'Subscription was canceled'],
                    ['invoice.paid', 'An invoice was paid successfully'],
                    ['invoice.payment_failed', 'Payment failed — subscription may lapse'],
                  ].map(([event, desc]) => (
                    <tr key={event}>
                      <td className="mono text-12 text-accent">{event}</td>
                      <td className="text-12 text-muted">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="p-muted">
              Webhook payloads are signed with your webhook secret. Verify signatures using the <code className="mono text-12 text-bright">stripe-signature</code> header.
            </p>
          </div>

          {/* Model Reference */}
          <div className="docs-section">
            <div className="docs-eyebrow">Reference</div>
            <h2 className="text-20 font-600 mb-16">Model Reference</h2>
            <p className="p-muted mb-16">
              All available models with their API IDs. View <Link href="/models" className="text-accent no-underline">live performance metrics →</Link>
            </p>
            <div className="border-bright overflow-hidden">
              <table className="dash-table">
                <thead>
                  <tr className="bg-surface">
                    <th>Provider</th>
                    <th>Model</th>
                    <th>API ID</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['OpenAI', 'GPT-4o', 'gpt-4o'],
                    ['OpenAI', 'GPT-4o Mini', 'gpt-4o-mini'],
                    ['Anthropic', 'Claude Opus 4.7', 'claude-opus-4-7'],
                    ['Anthropic', 'Claude Sonnet 4.6', 'claude-sonnet-4-6'],
                    ['Anthropic', 'Claude Sonnet 4.5', 'claude-sonnet-4-5'],
                    ['Anthropic', 'Claude Haiku 3.5', 'claude-haiku-3-5'],
                    ['Google', 'Gemini 2.5 Pro', 'gemini-2.5-pro'],
                    ['Google', 'Gemini 2.5 Flash', 'gemini-2.5-flash'],
                    ['DeepSeek', 'DeepSeek V3', 'deepseek-v3'],
                    ['DeepSeek', 'DeepSeek R1', 'deepseek-r1'],
                    ['xAI', 'Grok 3', 'grok-3'],
                    ['xAI', 'Grok 3 Mini', 'grok-3-mini'],
                    ['Meta', 'Llama 4', 'llama-4'],
                    ['Meta', 'Llama 3.3 70B', 'llama-3.3-70b'],
                    ['Mistral', 'Mistral Large 3', 'mistral-large-3'],
                    ['Mistral', 'Mistral Small 3', 'mistral-small-3'],
                    ['Moonshot', 'Moonshot v1', 'moonshot-v1'],
                    ['Moonshot', 'Moonshot v1 32K', 'moonshot-v1-32k'],
                  ].map(([provider, model, id]) => (
                    <tr key={id}>
                      <td className="mono text-12 text-muted">{provider}</td>
                      <td className="text-12">{model}</td>
                      <td className="mono text-12 text-accent">{id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Foot */}
          <div className="flex gap-24 items-center" style={{ padding: '32px 64px', borderBottom: '1px solid var(--border-bright)' }}>
            <Link href="/quickstart" className="mono text-13 text-accent no-underline">← Quickstart</Link>
            <span className="text-muted text-12">|</span>
            <Link href="/guides" className="mono text-13 text-accent no-underline">Integration Guides →</Link>
          </div>

          {/* Footer */}
          <div className="flex-between mono text-10 text-muted uppercase" style={{ padding: '20px 32px', borderTop: '1px solid var(--border-bright)', letterSpacing: '0.06em' }}>
            <span>© 2026 AIKOMPUTE INC.</span>
            <div className="flex gap-24">
              <Link href="/terms" className="text-muted no-underline">Terms</Link>
              <Link href="/privacy" className="text-muted no-underline">Privacy</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

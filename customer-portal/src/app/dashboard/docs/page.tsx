export default function DocsPage() {
  const baseUrl = 'https://yourdomain.com';
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-2">API Documentation</h1>
      <p className="text-[var(--color-text-secondary)] text-sm mb-8">OpenAI-compatible REST API</p>
      <div className="space-y-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-3">Base URL</h2>
          <code className="block bg-[var(--color-bg-primary)] rounded-lg px-4 py-3 text-sm font-mono text-[var(--color-accent)]">{baseUrl}/v1</code>
        </div>
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-3">Authentication</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">Include your API key in the Authorization header:</p>
          <code className="block bg-[var(--color-bg-primary)] rounded-lg px-4 py-3 text-sm font-mono">Authorization: Bearer YOUR_API_KEY</code>
        </div>
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-3">Chat Completions</h2>
          <pre className="bg-[var(--color-bg-primary)] rounded-lg px-4 py-3 text-sm font-mono overflow-x-auto">{`POST /v1/chat/completions
{
  "model": "gpt-4o",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "stream": false
}`}</pre>
        </div>
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-3">List Models</h2>
          <code className="block bg-[var(--color-bg-primary)] rounded-lg px-4 py-3 text-sm font-mono">GET /v1/models</code>
        </div>
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-3">Rate Limits</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">Rate limits depend on your plan. When exceeded, you&apos;ll receive a 429 status code. Check response headers for limit details.</p>
        </div>
      </div>
    </div>
  );
}

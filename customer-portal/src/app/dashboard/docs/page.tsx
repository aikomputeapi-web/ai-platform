export default function DocsPage() {
  const baseUrl = 'https://yourdomain.com';
  return (
    <div>
      <div className="dash-page-header">
        <h1 className="dash-page-title">API Documentation</h1>
        <p className="dash-page-sub">OpenAI-compatible REST API</p>
      </div>

      <div className="dash-card">
        <div className="dash-card-title">Base URL</div>
        <div className="dash-code text-accent">{baseUrl}/v1</div>
      </div>

      <div className="dash-card">
        <div className="dash-card-title">Authentication</div>
        <p className="text-13 text-muted mb-12">Include your API key in the Authorization header:</p>
        <div className="dash-code">Authorization: Bearer YOUR_API_KEY</div>
      </div>

      <div className="dash-card">
        <div className="dash-card-title">Chat Completions</div>
        <pre className="dash-code dash-code-wrap">{`POST /v1/chat/completions
{
  "model": "gpt-4o",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "stream": false
}`}</pre>
      </div>

      <div className="dash-card">
        <div className="dash-card-title">List Models</div>
        <div className="dash-code">GET /v1/models</div>
      </div>

      <div className="dash-card">
        <div className="dash-card-title">Rate Limits</div>
        <p className="text-13 text-muted" style={{ lineHeight: 1.7 }}>
          Rate limits depend on your plan. When exceeded, you&apos;ll receive a 429 status code. Check response headers for limit details.
        </p>
      </div>
    </div>
  );
}

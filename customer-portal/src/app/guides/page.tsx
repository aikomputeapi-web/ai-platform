import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const GUIDES = [
  {
    lang: 'Python',
    desc: 'Using the OpenAI Python SDK with aikompute.',
    code: `pip install openai`,
    snippet: `from openai import OpenAI

client = OpenAI(
    api_key="ork_YOUR_API_KEY",
    base_url="https://api.aikompute.com/v1"
)

# Chat completion
response = client.chat.completions.create(
    model="claude-sonnet-4-5",
    messages=[{"role": "user", "content": "Hello!"}],
    stream=False
)
print(response.choices[0].message.content)

# Streaming
stream = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Write a poem"}],
    stream=True
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")`,
  },
  {
    lang: 'Node.js / TypeScript',
    desc: 'Using the OpenAI Node.js SDK with aikompute.',
    code: `npm install openai`,
    snippet: `import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: 'ork_YOUR_API_KEY',
    baseURL: 'https://api.aikompute.com/v1',
});

// Chat completion
const response = await client.chat.completions.create({
    model: 'claude-sonnet-4-5',
    messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(response.choices[0].message.content);

// Streaming
const stream = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Tell me a story' }],
    stream: true,
});
for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
}`,
  },
  {
    lang: 'cURL',
    desc: 'Raw HTTP requests via cURL.',
    code: null,
    snippet: `# Chat completion
curl -X POST https://api.aikompute.com/v1/chat/completions \\
  -H "Authorization: Bearer ork_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'

# List models
curl -H "Authorization: Bearer ork_YOUR_API_KEY" \\
  https://api.aikompute.com/v1/models`,
  },
  {
    lang: 'Go',
    desc: 'Using the OpenAI Go client.',
    code: `go get github.com/openai/openai-go`,
    snippet: `package main

import (
    "context"
    "fmt"
    "github.com/openai/openai-go"
)

func main() {
    client := openai.NewClient(
        openai.WithAPIKey("ork_YOUR_API_KEY"),
        openai.WithBaseURL("https://api.aikompute.com/v1"),
    )

    res, err := client.Chat.Completions.New(
        context.Background(),
        openai.ChatCompletionNewParams{
            Model: openai.F("claude-sonnet-4-5"),
            Messages: openai.F([]openai.ChatCompletionMessageParamUnion{
                openai.UserMessage("Hello!"),
            }),
        },
    )
    if err != nil {
        panic(err)
    }
    fmt.Println(res.Choices[0].Message.Content)
}`,
  },
  {
    lang: 'Ruby',
    desc: 'Using the Ruby OpenAI gem.',
    code: `gem install ruby-openai`,
    snippet: `require 'openai'

client = OpenAI::Client.new(
  access_token: 'ork_YOUR_API_KEY',
  uri_base: 'https://api.aikompute.com/v1'
)

response = client.chat(
  parameters: {
    model: 'claude-sonnet-4-5',
    messages: [{ role: 'user', content: 'Hello!' }],
  }
)
puts response.dig('choices', 0, 'message', 'content')`,
  },
  {
    lang: 'Java / Kotlin',
    desc: 'Using the OpenAI Java client.',
    code: null,
    snippet: `// build.gradle.kts
// implementation("com.openai:openai:0.1.0")

OpenAI client = OpenAI.builder()
    .apiKey("ork_YOUR_API_KEY")
    .baseUrl("https://api.aikompute.com/v1")
    .build();

ChatCompletionRequest req = ChatCompletionRequest.builder()
    .model("claude-sonnet-4-5")
    .messages(List.of(ChatMessage.of("user", "Hello!")))
    .build();

client.chatCompletion(req)
    .getChoices()
    .forEach(c -> System.out.println(c.getMessage().getContent()));`,
  },
];

export default function GuidesPage() {
  return (
    <div className="page-shell">
      <Header />

      <div className="page-hero">
        <div className="hero-tag mb-16">GUIDES</div>
        <h1 className="heading-hero">
          Integration<br />Guides.
        </h1>
        <p className="hero-desc text-max-480">
          Everything you need to integrate AIKOMPUTE in your preferred language. Fully OpenAI-compatible.
        </p>
      </div>

      {GUIDES.map((guide, i) => (
        <div key={guide.lang} className="border-bottom">
          <div className="section-label-bar-surface" style={{ padding: '12px 64px' }}>
            {String(i + 1).padStart(2, '0')} — {guide.lang}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            <div className="p-12" style={{ borderRight: '1px solid var(--border)' }}>
              <p className="text-14 text-muted mb-16" style={{ lineHeight: 1.7 }}>{guide.desc}</p>
              <div className="mono text-10 uppercase text-muted mb-8" style={{ letterSpacing: '0.15em' }}>Install</div>
              <code className="mono block bg-surface border-default" style={{ padding: '12px', fontSize: '12px', color: 'var(--accent)' }}>
                {guide.code || 'No install required (HTTP client built-in)'}
              </code>
            </div>
            <div className="bg-bg" style={{ padding: '0', position: 'relative' }}>
              <pre className="mono" style={{ padding: '32px', fontSize: '11px', lineHeight: 1.8, color: 'var(--text)', overflowX: 'auto', margin: 0 }}>{guide.snippet}</pre>
            </div>
          </div>
        </div>
      ))}

      <div className="page-section">
        <div className="mono text-10 uppercase text-muted mb-12" style={{ letterSpacing: '0.12em' }}>NEED HELP?</div>
        <p className="text-14 text-muted text-max-600" style={{ lineHeight: 1.6 }}>
          Don&apos;t see your language? AIKOMPUTE works with any OpenAI-compatible client. Just set the base URL and API key.
          Visit our <Link href="/faq" className="text-accent" style={{ textDecoration: 'none' }}>FAQ</Link> or <Link href="/support" className="text-accent" style={{ textDecoration: 'none' }}>contact support</Link>.
        </p>
      </div>

      <Footer />
    </div>
  );
}

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
    api_key="API_KEY",
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
    apiKey: 'API_KEY',
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
  -H "Authorization: Bearer API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'

# List models
curl -H "Authorization: Bearer API_KEY" \\
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
        openai.WithAPIKey("API_KEY"),
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
  access_token: 'API_KEY',
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
    .apiKey("API_KEY")
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
  {
    lang: 'Cursor',
    desc: 'Configure Cursor to use aikompute as your AI model provider.',
    code: null,
    snippet: `1. Open Cursor → Settings → Models
2. Toggle OFF "Use OpenAI / Azure OpenAI"
   (or whichever default provider is active)
3. Under "API Key", enter: API_KEY
4. Under "API Endpoint" / "Override Base URL",
   set: https://api.aikompute.com/v1
5. Select any OpenAI-compatible model from the dropdown
   (e.g., gpt-4o, claude-sonnet-4-5)
6. Click "Verify" to test the connection

Cursor will now route all AI features
(Chat, Composer, Tab, Edit) through aikompute.`,
  },
  {
    lang: 'Windsurf',
    desc: 'Connect Windsurf AI code editor to aikompute.',
    code: null,
    snippet: `1. Open Windsurf → Settings (⌘,)
2. Search for: "openai"
3. Set "OpenAI: Base URL" to:
   https://api.aikompute.com/v1
4. Set "OpenAI: API Key" to: API_KEY
5. (Optional) Set "OpenAI: Model" to your preferred
   model (e.g., claude-sonnet-4-5, gpt-4o)

Alternatively via settings.json:
{
  "openai.apiKey": "API_KEY",
  "openai.baseUrl": "https://api.aikompute.com/v1"
}

Windsurf will use aikompute for all AI features
including Cascade, inline edits, and chat.`,
  },
  {
    lang: 'Trae',
    desc: 'Set up Trae with aikompute as the AI backend.',
    code: null,
    snippet: `1. Open Trae → Settings (⌘,)
2. Go to "AI" or "Extensions" section
3. Find the API configuration panel
4. Set API Type: OpenAI Compatible
5. Set API Base URL: https://api.aikompute.com/v1
6. Set API Key: API_KEY
7. Choose your default model (e.g., claude-sonnet-4-5)

Trae will now use aikompute for code
completions, chat, and AI-powered refactoring.`,
  },
  {
    lang: 'Cline',
    desc: 'Configure the Cline VS Code extension for aikompute.',
    code: null,
    snippet: `1. Install "Cline" from VS Code Marketplace
2. Open Cline extension settings (gear icon)
3. Set API Provider: OpenAI Compatible
4. Set Base URL: https://api.aikompute.com/v1
5. Set API Key: API_KEY
6. Set Model ID: claude-sonnet-4-5 (or your choice)

Or via VS Code settings.json:
{
  "cline.apiProvider": "openai",
  "cline.openAiBaseUrl": "https://api.aikompute.com/v1",
  "cline.openAiApiKey": "API_KEY",
  "cline.openAiModel": "claude-sonnet-4-5"
}

Cline will use aikompute for all agentic
coding tasks: file editing, terminal commands,
and full-stack development.`,
  },
  {
    lang: 'Kilocode',
    desc: 'Point Kilocode to aikompute for AI-powered development.',
    code: null,
    snippet: `1. Open Kilocode → Preferences → Settings
2. Navigate to "AI / Models" section
3. Enable "Custom API Endpoint"
4. Set API Endpoint: https://api.aikompute.com/v1
5. Set API Key: API_KEY
6. Select or enter model: claude-sonnet-4-5

Or via config file:
{
  "ai.endpoint": "https://api.aikompute.com/v1",
  "ai.apiKey": "API_KEY",
  "ai.model": "claude-sonnet-4-5"
}

Kilocode will route all assistant queries,
code generation, and inline suggestions
through aikompute.`,
  },
  {
    lang: 'Open Hands',
    desc: 'Run Open Hands AI agent with aikompute backend.',
    code: `docker pull openhands/openhands`,
    snippet: `1. Start Open Hands with environment variables:

docker run -d --name openhands \\
  -e LLM_API_KEY="API_KEY" \\
  -e LLM_BASE_URL="https://api.aikompute.com/v1" \\
  -e LLM_MODEL="claude-sonnet-4-5" \\
  -p 3000:3000 \\
  openhands/openhands

2. Open http://localhost:3000 in your browser

3. The agent will use aikompute for all
   autonomous coding tasks: browsing, editing,
   testing, and deployment.`,
  },
  {
    lang: 'Zoo Code',
    desc: 'Connect Zoo Code AI assistant to aikompute.',
    code: null,
    snippet: `1. Open Zoo Code → Settings → AI
2. Set API Provider: OpenAI Compatible
3. Set Base URL: https://api.aikompute.com/v1
4. Set API Key: API_KEY
5. Set Model: claude-sonnet-4-5 (or your choice)

Or via .zoocoderc file in project root:
{
  "ai_provider": "openai",
  "openai_base_url": "https://api.aikompute.com/v1",
  "openai_api_key": "API_KEY",
  "openai_model": "claude-sonnet-4-5"
}

Zoo Code will use aikompute for chat,
inline completions, and agent mode.`,
  },
  {
    lang: 'Continue (VS Code / JetBrains)',
    desc: 'Use aikompute with the Continue open-source AI assistant.',
    code: null,
    snippet: `1. Install "Continue" from VS Code Marketplace
   or JetBrains Marketplace
2. Open Continue extension → gear icon → Config
3. Edit config.json:

{
  "models": [{
    "title": "aikompute",
    "provider": "openai",
    "model": "claude-sonnet-4-5",
    "apiKey": "API_KEY",
    "apiBase": "https://api.aikompute.com/v1"
  }],
  "tabAutocompleteModel": {
    "title": "aikompute-tab",
    "provider": "openai",
    "model": "gpt-4o-mini",
    "apiKey": "API_KEY",
    "apiBase": "https://api.aikompute.com/v1"
  }
}

Continue will use aikompute for chat, edit,
and tab autocomplete features.`,
  },
  {
    lang: 'Aider',
    desc: 'Use aikompute as the LLM backend for Aider (terminal AI pair programming).',
    code: `pip install aider-chat`,
    snippet: `# Set environment variables:
export AIDER_API_KEY="API_KEY"
export AIDER_API_BASE="https://api.aikompute.com/v1"
export AIDER_MODEL="openai/claude-sonnet-4-5"

# Or use command-line flags:
aider --api-key API_KEY \\
      --api-base https://api.aikompute.com/v1 \\
      --model openai/claude-sonnet-4-5

# Use with directory:
aider /path/to/your/project

Aider will use aikompute for all pair
programming, refactoring, and git-aware edits.`,
  },
  {
    lang: 'CodeGPT',
    desc: 'Connect CodeGPT to aikompute for AI assistance.',
    code: null,
    snippet: `1. Open CodeGPT extension settings
2. Set Provider: OpenAI Compatible
3. Set Base URL: https://api.aikompute.com/v1
4. Set API Key: API_KEY
5. Set Model: claude-sonnet-4-5

Or via settings.json:
{
  "codegpt.apiKey": "API_KEY",
  "codegpt.basePath": "https://api.aikompute.com/v1",
  "codegpt.model": "claude-sonnet-4-5",
  "codegpt.provider": "openai"
}

CodeGPT will use aikompute for code
generation, explanation, and chat.`,
  },
  {
    lang: 'Claude Code',
    desc: 'Use aikompute as the model provider for Claude Code (Anthropic\'s terminal AI agent).',
    code: `npm install -g @anthropic-ai/claude-code`,
    snippet: `# 1. Set the ANTHROPIC_BASE_URL to aikompute
export ANTHROPIC_BASE_URL="https://api.aikompute.com"

# 2. Set your aikompute API key
export ANTHROPIC_API_KEY="API_KEY"

# 3. Launch Claude Code
claude

# Or specify a custom model:
claude --model claude-sonnet-4-5

# With a project directory:
cd /path/to/your/project && claude

Claude Code will route all agentic coding
tasks — file editing, shell commands,
git operations, and research — through aikompute.`,
  },
  {
    lang: 'Codex (OpenAI)',
    desc: 'Configure OpenAI Codex CLI to use aikompute.',
    code: `pip install openai-codex`,
    snippet: `# 1. Set the OpenAI API base URL to aikompute
export OPENAI_API_BASE="https://api.aikompute.com/v1"

# 2. Set your aikompute API key
export OPENAI_API_KEY="API_KEY"

# 3. Set the default model (optional)
export OPENAI_API_MODEL="claude-sonnet-4-5"

# 4. Launch Codex
codex

# Run codex with a prompt directly:
codex "Build a React todo app with local storage"

Codex will use aikompute for all code
generation, explanation, and debugging tasks.`,
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
          Everything you need to integrate AIKOMPUTE in your preferred language or AI coding tool. Fully OpenAI-compatible.
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
                {guide.code || 'No install required (configuration-based)'}
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
          Don't see your tool? AIKOMPUTE works with any OpenAI-compatible client. Just set the base URL and API key.
          Visit our <Link href="/faq" className="text-accent" style={{ textDecoration: 'none' }}>FAQ</Link> or <Link href="/support" className="text-accent" style={{ textDecoration: 'none' }}>contact support</Link>.
        </p>
      </div>

      <Footer />
    </div>
  );
}

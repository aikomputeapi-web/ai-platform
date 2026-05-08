# AI Platform — Unified AI Inference Platform

> One platform. One portal. One control plane.

---

## 🚀 Deploy

```bash
chmod +x setup.sh manage.sh
sudo ./setup.sh
```

It asks for your domain, then does everything automatically.

---

## What You Get

**One deployment** (e.g. `aiapi.indevs.in`) that serves three surfaces:

| URL | What It Does |
|-----|-------------|
| `yourdomain.com` | **Customer Landing Page & Portal** — where your users sign up, log in, manage API keys, and handle billing. |
| `admin.yourdomain.com` | **Your Admin Dashboard** — manage user accounts, provider accounts, models, and routing. Protected by the admin password. |
| `yourdomain.com/v1` | **API Endpoint** — your users connect their applications here using the API keys they generated in the Customer Portal. |

**One control plane** where you manage everything:

| Provider | Auth Method | How to Add |
|----------|------------|------------|
| Claude Code | OAuth | Click "Connect" → login in browser |
| Gemini CLI | OAuth | Click "Connect" → login with Google |
| Antigravity | OAuth | Click "Connect" → login with Google |
| GitHub Copilot | OAuth | Click "Connect" → login with GitHub |
| OpenAI Codex | OAuth | Click "Connect" → login with OpenAI |
| Kiro (Amazon) | OAuth | Click "Connect" → login with AWS |
| Qwen Code | OAuth | Click "Connect" → login |
| Kimi Coding | OAuth | Click "Connect" → login |
| Qoder | OAuth | Click "Connect" → login |
| DeepSeek | API Key | Paste your API key |
| Groq | API Key | Paste your API key |
| xAI / Grok | API Key | Paste your API key |
| Mistral | API Key | Paste your API key |
| Perplexity | API Key | Paste your API key |
| Together AI | API Key | Paste your API key |
| Fireworks | API Key | Paste your API key |
| Cerebras | API Key | Paste your API key |
| Cohere | API Key | Paste your API key |
| NVIDIA NIM | API Key | Paste your API key |
| OpenRouter | API Key | Paste your API key |
| Any OpenAI-compatible | API Key | Paste key + set base URL |

**No switching between separate products.** The portal, admin UI, API gateway, and backend services are deployed together and managed as one platform.

---

## Architecture

```
Internet → Nginx (SSL + rate limiting)
               │
               ├── yourdomain.com/v1  → OmniRoute API (:20129)
               ├── yourdomain.com/    → Customer Portal (:3000)
               └── admin.domain.com/  → OmniRoute Dashboard (:20128)
                                        │
                              ├── OAuth providers (direct)
                              ├── API key providers (direct)
                              └── CLIProxyAPI sidecar (:8317, internal only)

Supporting:
  PostgreSQL (:5432) — users, plans, billing, and portal data
  Redis (:6379) — session cache, rate limits, account pool state
```

The unified stack runs as **4 containers** total. CLIProxyAPI has no public API port exposed; OmniRoute manages it internally, and the customer portal talks to the shared database plus the OmniRoute control plane.

---

## Free Domain Setup (StackRyze)

1. Go to [domain.stackryze.com](https://domain.stackryze.com)
2. Claim `yourname.indevs.in` or `yourname.sryze.cc`
3. Add **A record** → your GCP VM's IP
4. Run `sudo ./setup.sh`, enter your domain
5. SSL is automatic via Let's Encrypt

---

## Management

```bash
./manage.sh status     # Health + resource usage
./manage.sh logs       # Tail all logs
./manage.sh backup     # Full backup
./manage.sh restore    # Restore from backup
./manage.sh restart    # Restart everything
./manage.sh update     # Pull latest + rebuild
./manage.sh ssl-renew  # Force SSL renewal
./manage.sh shell omniroute  # Debug inside container
```

---

## Files

```
ai-platform/
├── setup.sh                     ← Run this (one command)
├── manage.sh                    ← Day-to-day ops
├── docker-compose.unified.yml   ← 4 services
├── .env                         ← Auto-generated secrets
├── nginx/nginx.conf             ← Nginx config
├── customer-portal/             ← Customer-facing web app
├── OmniRoute/                   ← OmniRoute source
└── backups/                     ← Auto-managed
```

---

## GCP VM Sizing

| Users | VM | RAM |
|-------|----|-----|
| 100 | e2-standard-2 | 8 GB |
| 500 | e2-standard-4 | 16 GB |
| 1000+ | e2-standard-8 | 32 GB |

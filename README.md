# Digital Me

Digital Me is an AI-powered personal digital twin. It's designed to ingest your personal data (resume, GitHub activity, etc.) and use a local LLM (via Ollama) to answer questions as if it were you.

## Features

| Category                      | Details                                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **RAG Pipeline**              | Retrieval-Augmented Generation grounded in your personal data for accurate, contextual answers                   |
| **Smart Memory Router**       | Keyword & LLM-based query classification across Static, Dynamic, and Conversational memory types                 |
| **Structure-Aware Ingestion** | Two-stage document pipeline — parses PDFs & text into structured sections, then chunks with configurable overlap |
| **Multi-Source Data**         | Resume (PDF), `me.json` identity config, GitHub (profile + repos + commits), Strava (activities)                 |
| **CLI Interface**             | `chat` and `ingest` commands powered by [Commander](https://github.com/tj/commander.js)                          |
| **Next.js API**               | RESTful chat endpoint with full RAG orchestration                                                                |
| **100% Local**                | Powered by Ollama (Llama 3) — your data never leaves your machine                                                |

## 🏗️ Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   CLI Chat   │────▶│  Next.js API │────▶│   Ollama (LLM)   │
└──────────────┘     └─────┬────────┘     └──────────────────┘
                           │                       ▲
                           ▼                       │
                    ┌──────────────┐         ┌─────┴───────┐
                    │ Memory Router│────────▶│ Vector Store│
                    └──────┬───────┘         └─────┬───────┘
                           │                       ▲
              ┌────────────┼────────────┐          │
              ▼            ▼            ▼          │
        ┌──────────┐ ┌──────────┐ ┌──────────┐     │
        │  Static  │ │ Dynamic  │ │ Conversa-│     │
        │  Memory  │ │  Memory  │ │  tional  │     │
        └──────────┘ └──────────┘ └──────────┘     │
              │            │                       │
              ▼            ▼                       │
        ┌──────────┐ ┌──────────┐                  │
        │Resume/PDF│ │ GitHub   │                  │
        │ me.json  │ │ Strava   │──────────────────┘
        └──────────┘ └──────────┘
```

## 📁 Project Structure

```
digital-me/
├── app/
│   ├── api/              # Next.js API Route Handlers (chat, report, mcp, models)
│   │   ├── chat/route.ts     # Chat completion + RAG orchestration
│   │   └── report/route.ts   # Report retrieval & generation
│   ├── components/       # Frontend UI components (ChatInterface, WeeklyReport, etc.)
│   ├── globals.css       # Global styles (Tailwind CSS)
│   ├── layout.tsx        # App layout
│   └── page.tsx          # Main application page
├── cli/
│   ├── index.ts          # CLI entrypoint (Commander)
│   └── chat.ts           # Interactive chat session
├── memory/
│   ├── ingest.ts         # Orchestrates dynamic MCP-based ingestion pipeline
│   ├── router.ts         # MemoryRouter — routes queries by type
│   ├── vector_store/     # Embedding storage & cosine similarity search (JSON vector store)
│   └── data_processing/  # Document parsing (PDF, JSON, HTML, Text) & chunking
│       └── parsers/      # Parsers for PDF, Markdown, JSON and HTML
├── model/
│   ├── agents/           # Specialized agents (Groq agent, Semantic Router, JSON agent)
│   ├── middleware/       # LLM provider middleware (caching, rate limiting, logging)
│   ├── providers/        # LLM providers (Ollama, Gemini, Groq, GPT)
│   └── prompts/          # System prompts & prompt templates
├── public/               # Raw static data sources
│   ├── codes/            # Structured config (e.g., me.json, router_config.json)
│   └── documents/        # PDFs, Markdown, Text (e.g., resume.pdf)
└── scripts/
    └── dev-cli.js        # Dev helper for CLI execution
```

## 📋 Prerequisites

- **Node.js** v18+
- **Ollama** installed and running — pull a model:
  ```bash
  ollama pull llama3
  ```
- **GitHub Token** — [Personal Access Token](https://github.com/settings/tokens) with `repo` and `read:user` scopes
- **Strava Token** — API token with `read`, `activity:read`, `activity:write`, `activity:read_all` scopes

## 🚀 Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/digital-me.git
cd digital-me
npm install
```

### 2. Configure Environment

Create a `.env.local` file in the project root:

```env
# LLM Provider (ollama, gemini, groq, gpt)
LLM_PROVIDER=ollama

# GitHub integration
GITHUB_TOKEN=your_github_token
GITHUB_USERNAME=your_github_username

# Strava integration
STRAVA_ACCESS_TOKEN=your_strava_token

# LinkedIn integration
LINKEDIN_CLIENT_ID=your_linkedin_id
LINKEDIN_CLIENT_SECRET=your_linkedin_secret

# Optional: Override API URL
# e.g.:
# DIGITAL_ME_API_URL=http://localhost:7001/api
```

### 3. Prepare Your Data

| File                           | Purpose                                               |
| ------------------------------ | ----------------------------------------------------- |
| `public/documents/resume.pdf`  | Your resume (parsed via LLM into structured sections) |
| `public/codes/me.json`         | Structured personal metadata / identity configuration |

### 4. Run

```bash
# Terminal 1 — Start the API server
npm run dev

# Terminal 2 — Ingest your data into the vector store
npm run cli ingest

# Terminal 3 — Run the scheduler
npm run scheduler

# Terminal 4 — Start chatting with your digital twin
npm run cli chat
```

## 🧰 Available Scripts

| Script               | Description                                   |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Start the Next.js dev server                  |
| `npm run build`      | Production build                              |
| `npm run start`      | Start production server                       |
| `npm run cli ingest` | Ingest all data sources into the vector store |
| `npm run cli sync`   | Sync latest changes into vector store         |
| `npm run cli chat`   | Launch the interactive chat CLI               |
| `npm run test`       | Run tests with Vitest                         |
| `npm run lint`       | Lint with ESLint                              |
| `npm run scheduler`  | Run the scheduler                             |

## 🔮 Roadmap

- [x] **More Integrations** — LinkedIn, Instagram, Google Fit
- [ ] **Dynamic Modes** — Intent-based persona switching (Recruiter vs. Friend mode)
- [ ] **Rich Responses** — Serve visual UI components (GitHub stats, heatmaps, activity charts)
- [ ] **Hardware Integration** — ESP32 sensors for live status, room presence & ambient interaction
- [ ] **Voice Interface** — Conversational voice input/output
- [ ] **On-Device Inference** — Run smaller models directly on edge hardware
- [ ] **Agent Scheduling** — Automated periodic data refresh & proactive notifications

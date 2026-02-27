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
│   └── api/              # Next.js API route — chat endpoint + RAG logic
├── cli/
│   ├── index.ts          # CLI entrypoint (Commander)
│   └── chat.ts           # Interactive chat session
├── integrations/
│   ├── github/           # GitHub profile, repos & commit ingestion
│   └── strava/           # Strava activity ingestion
├── memory/
│   ├── ingest.ts         # Orchestrates full ingestion pipeline
│   ├── router.ts         # MemoryRouter — routes queries by type
│   ├── vector_store/     # Embedding storage & cosine similarity search
│   ├── data_processing/  # Document parsing, structure analysis & chunking
│   └── static/           # Static data sources (me.json, resume.pdf)
├── model/
│   ├── llm/              # Ollama client configuration
│   └── prompts/          # System prompts & prompt templates
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
# GitHub integration
GITHUB_TOKEN=your_github_token
GITHUB_USERNAME=your_github_username

# Strava integration
STRAVA_ACCESS_TOKEN=your_strava_token

# Optional: Override API URL
# e.g.:
# DIGITAL_ME_API_URL=http://localhost:7000/api
```

### 3. Prepare Your Data

| File                       | Purpose                                               |
| -------------------------- | ----------------------------------------------------- |
| `memory/static/resume.pdf` | Your resume (parsed via LLM into structured sections) |

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
| `npm run cli chat`   | Launch the interactive chat CLI               |
| `npm run test`       | Run tests with Vitest                         |
| `npm run lint`       | Lint with ESLint                              |
| `npm run scheduler`  | Run the scheduler                             |

## 🔮 Roadmap

- [ ] **More Integrations** — LinkedIn, Instagram, Google Fit
- [ ] **Dynamic Modes** — Intent-based persona switching (Recruiter vs. Friend mode)
- [ ] **Rich Responses** — Serve visual UI components (GitHub stats, heatmaps, activity charts)
- [ ] **Hardware Integration** — ESP32 sensors for live status, room presence & ambient interaction
- [ ] **Voice Interface** — Conversational voice input/output
- [ ] **On-Device Inference** — Run smaller models directly on edge hardware
- [ ] **Agent Scheduling** — Automated periodic data refresh & proactive notifications

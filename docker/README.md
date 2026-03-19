# Docker Setup for Digital Me

Run the full Digital Me stack in a container using **Groq** as the LLM provider — no local model downloads needed.

## Prerequisites

- **Docker Desktop** installed and running
- **Groq API Key** — get one from [console.groq.com/keys](https://console.groq.com/keys)

## Step-by-Step Setup

### Step 1 — Configure environment variables

Open `docker/.env.docker` and fill in your API keys:

```bash
# Required
GROQ_API_KEY=your_groq_api_key_here

# Optional integrations
GITHUB_USERNAME=your_github_username
GITHUB_TOKEN=your_github_token
STRAVA_ACCESS_TOKEN=your_strava_token
# ... see .env.docker for all options
```

### Step 2 — Build and start the container

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

> First build takes ~45 seconds. Subsequent builds are cached and near-instant.

### Step 3 — Verify it's running

```bash
docker ps
```

You should see:
```
NAMES        STATUS         PORTS
digital-me   Up (healthy)   0.0.0.0:7001->7001/tcp
```

### Step 4 — Open the app

Open **http://localhost:7001** in your browser.

### Step 5 — Use the CLI (optional)

```bash
# Ingest your data
docker exec -it digital-me npm run cli ingest

# Chat with the AI
docker exec -it digital-me npm run cli chat
```

## Architecture

```
┌──────────────────────────────────────────┐
│           docker compose                  │
│                                           │
│  ┌──────────────────────────────────┐    │
│  │  app (digital-me)                │    │
│  │  Next.js + CLI + Groq Cloud API  │    │
│  │  :7001                           │    │
│  └──────────┬───────────────────────┘    │
│             │                             │
│        ┌────▼─────┐                      │
│        │ data/    │ (volume mount)       │
│        │ memory/  │                      │
│        │ .logs/   │                      │
│        └──────────┘                      │
└──────────────────────────────────────────┘
```

## Services

| Service | Container | Port | Description |
|---------|-----------|------|-------------|
| `app` | `digital-me` | 7001 | Next.js web UI + API + CLI |
| `scheduler` | `digital-me-scheduler` | — | Cron jobs (opt-in, see below) |

## Volume Mounts

| Host Path | Container Path | Purpose |
|-----------|---------------|---------|
| `data/` | `/digital-me/data` | Vector store, processed data, reports |
| `memory/` | `/digital-me/memory` | Memory layer (static, dynamic, episodic) |
| `.logs/` | `/digital-me/.logs` | Application logs |

## Scheduler (optional)

Start the scheduler alongside the app:

```bash
docker compose -f docker/docker-compose.yml --profile scheduler up -d
```

## Useful Commands

```bash
# View logs
docker compose -f docker/docker-compose.yml logs -f

# View app logs only
docker compose -f docker/docker-compose.yml logs -f app

# Stop everything
docker compose -f docker/docker-compose.yml down

# Rebuild after code changes
docker compose -f docker/docker-compose.yml up -d --build

# Check container health
docker compose -f docker/docker-compose.yml ps
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `model does not exist` error in logs | Ensure `GROQ_CHAT_MODEL=llama-3.1-8b-instant` and `GROQ_EMBEDDING_MODEL=nomic-embed-text-v1_5` in `.env.docker` |
| App unreachable on localhost:7001 | Run `docker ps` — container may have exited. Check `docker logs digital-me` |
| Build fails on M-series Mac | Ensure Docker Desktop is updated and Rosetta is enabled |
| Port 7001 already in use | Stop any local dev server: `npm run dev` or similar |
| CLI chat times out | The CLI connects to the API inside the container — ensure the container is running first |

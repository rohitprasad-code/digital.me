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
  Internet
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│                    docker compose                        │
│                                                          │
│  ┌──────────────┐       ┌──────────────────────────┐    │
│  │  tunnel       │──────▶│  app (digital-me)         │    │
│  │  (cloudflared)│       │  Next.js + Groq Cloud API │    │
│  │               │       │  :7001                    │    │
│  └──────────────┘       └──────────┬───────────────┘    │
│                                     │                    │
│                                ┌────▼─────┐             │
│                                │ data/    │ (volumes)   │
│                                │ memory/  │             │
│                                │ .logs/   │             │
│                                └──────────┘             │
└─────────────────────────────────────────────────────────┘
```

## Services

| Service | Container | Port | Profile | Description |
|---------|-----------|------|---------|-------------|
| `app` | `digital-me` | 7001 | default | Next.js web UI + API + CLI |
| `tunnel` | `digital-me-tunnel` | — | `tunnel` | Cloudflare Tunnel (public access) |
| `scheduler` | `digital-me-scheduler` | — | `scheduler` | Cron jobs |

## Volume Mounts

| Host Path | Container Path | Purpose |
|-----------|---------------|---------|
| `data/` | `/digital-me/data` | Vector store, processed data, reports |
| `memory/` | `/digital-me/memory` | Memory layer (static, dynamic, episodic) |
| `.logs/` | `/digital-me/.logs` | Application logs |

## Cloudflare Tunnel (public access)

Expose the app to the internet via Cloudflare Tunnel — no port forwarding or static IP needed.

### Setup

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → **Networks** → **Tunnels** → **Create a tunnel**
2. Name it (e.g. `digital`) and copy the tunnel token
3. Paste the token in `docker-compose.yml` under the `tunnel` service's `command`
4. In the Cloudflare dashboard, **Add a public hostname**:

   | Field | Value |
   |-------|-------|
   | Subdomain | `digital` (or whatever you want) |
   | Domain | your domain (e.g. `rohitprasad.dev`) |
   | **Service URL** | **`http://app:7001`** |

   > **Important:** Use `http://app:7001` (the Docker service name), **not** `localhost:7001` — the tunnel runs inside a container.

5. Start with the tunnel profile:

```bash
docker compose -f docker/docker-compose.yml --profile tunnel up -d
```

Your app is now live at `https://digital.yourdomain.dev` 🚀

## Replicas (scaling)

Scale the app horizontally by running multiple replicas:

```bash
docker compose -f docker/docker-compose.yml up -d --scale app=3
```

> **Note:** When using `--scale`, remove `container_name` and fixed `ports` from the `app` service in `docker-compose.yml`, and use a port range instead (e.g. `"7001-7003:7001"`). The Cloudflare Tunnel will load-balance across replicas automatically since it routes to the `app` service.

## Scheduler (optional)

Start the cron scheduler as a separate container:

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
| Tunnel can't reach app | Service URL must be `http://app:7001` (not `localhost`) — they share a Docker network |

# Integrations

The `integrations/` module contains connectors for external services. Each integration follows a **standardized 4-file convention** and serves two purposes:

1. **Ingestion** — batch-fetches data and stores it in the vector store for RAG
2. **Tool Calling** — exposes live API methods as tools the AI agent can invoke at runtime

## File Convention

Every integration directory follows this structure (create only the files the service needs):

```
integrations/<service>/
├── auth.ts       # OAuth lifecycle — authorization, token exchange, refresh, persistence
├── client.ts     # API client class — all reusable methods for the service
├── tools.ts      # LLM tool definitions — thin adapters that call client.ts methods
└── index.ts      # Ingestion pipeline — batch-fetch data → format → store in vector DB
```

| File | Responsibility | Triggered By |
|------|---------------|-------------|
| `auth.ts` | OAuth flows, token exchange, refresh, `.env.local` persistence | `client.ts`, CLI commands |
| `client.ts` | HTTP calls to the external API, response parsing | `tools.ts`, `index.ts` |
| `tools.ts` | Tool schema (name, description, parameters) + `execute` wrappers | AI agent (via `model/tools/registry.ts`) |
| `index.ts` | Fetch → format → embed via `EmbeddingPipeline` | CLI `sync` command, scheduler |

> **Key rule:** `tools.ts` should never duplicate API logic — each `execute` function is a one-liner calling a `client.ts` method.

## Available Integrations

### GitHub

Fetches your GitHub profile, recent repositories, and public activity via the [Octokit](https://github.com/octokit/rest.js) client.

| Data     | Description                                                 |
| -------- | ----------------------------------------------------------- |
| Profile  | Username, bio, repo count, followers                        |
| Repos    | Top 5 recently updated — name, language, stars, description |
| Activity | Last 10 public events — pushes, PRs, issues                 |

**Required env vars:** `GITHUB_TOKEN`, `GITHUB_USERNAME`

**Tools:** `get_github_profile`, `get_github_repos`, `get_github_activity`

### Strava

Fetches your Strava athlete profile and recent activities via the [Strava API v3](https://developers.strava.com/docs/reference/).

| Data       | Description                                      |
| ---------- | ------------------------------------------------ |
| Profile    | Name, location, bio, follower count              |
| Activities | Last 20 — type, distance, time, elevation, speed |

**Required env vars:** `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`
_(access/refresh tokens are managed automatically after first OAuth flow)_

**Tools:** `get_strava_activities`, `get_strava_profile`

### LinkedIn

Fetches your LinkedIn profile via the [LinkedIn OpenID Connect API](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2).

| Data    | Description                            |
| ------- | -------------------------------------- |
| Profile | Name, email, headline, profile picture |

**Required env vars:** `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
_(access token managed automatically after first OAuth flow)_

**Tools:** `get_linkedin_profile`

### ESP32 (Smart Bulb)

Controls smart lighting via an ESP32 microcontroller over HTTP.

| Action    | Description                          |
| --------- | ------------------------------------ |
| Set State | Turn the bulb on or off              |
| Get State | Check if the bulb is currently on/off |

**Required env vars:** `BULB_API_URL` (defaults to `http://192.168.1.100`)

**Tools:** `set_bulb_state`, `get_bulb_state`

## File Structure

```
integrations/
├── index.ts                  # Registry — exports all integrators for ingestion
├── README.md
├── github/
│   ├── client.ts             # GitHubClient (Octokit wrapper)
│   ├── tools.ts              # LLM tools: profile, repos, activity
│   └── index.ts              # ingestGitHub() — fetch & store data
├── strava/
│   ├── auth.ts               # OAuth + token lifecycle (exchange, refresh, save)
│   ├── client.ts             # StravaClient (REST client with 401 retry)
│   ├── tools.ts              # LLM tools: activities, profile
│   └── index.ts              # ingestStrava() — fetch & store data
├── linkedin/
│   ├── auth.ts               # OAuth + token lifecycle
│   ├── client.ts             # LinkedInClient (OpenID Connect)
│   ├── tools.ts              # LLM tools: profile
│   └── index.ts              # ingestLinkedIn() — fetch & store data
├── esp32/
│   ├── client.ts             # ESP32Client (HTTP control)
│   └── tools.ts              # LLM tools: set/get bulb state
├── instagram/                # (planned)
└── leetcode/                 # (planned)
```

## Adding a New Integration

1. **Create the directory:** `integrations/<service>/`
2. **Add `client.ts`** with an API client class containing reusable methods
3. **Add `auth.ts`** if the service requires OAuth (token exchange, refresh, persistence)
4. **Add `tools.ts`** with tool definitions for the AI agent:
   ```typescript
   import { ToolDefinition } from "../../model/tools/types";
   import { MyClient } from "./client";

   const client = new MyClient();

   export const myTools: ToolDefinition[] = [
     {
       name: "get_my_data",
       description: "Fetches data from MyService. Use when the user asks about...",
       parameters: { type: "object", properties: {} },
       execute: async () => await client.getData(),
     },
   ];
   ```
5. **Register tools** in `model/tools/registry.ts`:
   ```typescript
   import { myTools } from "../../integrations/my-service/tools";
   // Add to allToolDefinitions: ...myTools,
   ```
6. **Add `index.ts`** for ingestion (if the service has data to embed):
   ```typescript
   import { ingestMyService } from "./my-service/index";
   // Add to integrators array in integrations/index.ts
   ```

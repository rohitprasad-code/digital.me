# Integrations

The `integrations/` module contains connectors for external services. Each integration fetches data from a third-party API, formats it into embeddable text chunks, and stores them in the vector store during ingestion.

## Available Integrations

### GitHub

Fetches your GitHub profile, recent repositories, and public activity via the [Octokit](https://github.com/octokit/rest.js) client.

| Data     | Description                                                 |
| -------- | ----------------------------------------------------------- |
| Profile  | Username, bio, repo count, followers                        |
| Repos    | Top 5 recently updated — name, language, stars, description |
| Activity | Last 10 public events — pushes, PRs, issues                 |

**Required env vars:** `GITHUB_TOKEN`, `GITHUB_USERNAME`

### Strava

Fetches your Strava athlete profile and recent activities via the [Strava API v3](https://developers.strava.com/docs/reference/).

| Data       | Description                                      |
| ---------- | ------------------------------------------------ |
| Profile    | Name, location, bio, follower count              |
| Activities | Last 20 — type, distance, time, elevation, speed |

**Required env var:** `STRAVA_ACCESS_TOKEN`

## File Structure

```
integrations/
├── index.ts              # Registry — exports all integrators
├── github/
│   ├── client.ts         # GitHubClient (Octokit wrapper)
│   └── index.ts          # ingestGitHub() — fetches & stores data
└── strava/
    ├── client.ts         # StravaClient (REST client)
    └── index.ts          # ingestStrava() — fetches & stores data
```

## Adding a New Integration

1. Create a new folder: `integrations/<service>/`
2. Add a `client.ts` with the API client class
3. Add an `index.ts` exporting an `ingest<Service>(vectorStore)` function
4. Register it in `integrations/index.ts`:

```typescript
import { ingestNewService } from "./new-service/index";

// Add to the integrators array:
{ name: "new-service", ingest: ingestNewService }
```

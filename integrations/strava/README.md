# Strava Integration

Connects Digital Me to the [Strava API v3](https://developers.strava.com/docs/reference/) to fetch your athlete profile and recent activities. Data is embedded into the vector store so the LLM can answer questions about your fitness and workouts.

## 🛠️ Implementation

### OAuth Flow

Strava uses **OAuth 2.0 Authorization Code** for access. The first time you run `npm run cli strava:auth`, the following happens:

```
CLI ──► Browser opens Strava consent page
         │
         ▼
User approves ──► Strava redirects to http://localhost:8000?code=...
                    │
                    ▼
           Local HTTP server (cli/oauth/strava-oauth-server.ts)
           captures the code and shuts down
                    │
                    ▼
           Code is exchanged for access + refresh tokens
           via POST /oauth/token
                    │
                    ▼
           Tokens are saved to .env.local
```

After the initial authorization, tokens are **refreshed automatically** — no browser interaction needed.

### Token Management (`token.ts`)

| Function                 | Purpose                                                               |
| ------------------------ | --------------------------------------------------------------------- |
| `ensureValidToken()`     | Main entry — runs full OAuth if no tokens, silent refresh if expired  |
| `refreshTokenSilently()` | Headless refresh used by the scheduler — never opens a browser        |
| `forceRefresh()`         | Forces a refresh even if the token looks valid                        |
| `getTokenStatus()`       | Returns current token state: `valid`, `expired`, `missing`, `unknown` |

- Tokens expire after ~6 hours. A **5-minute buffer** (`REFRESH_BUFFER_SEC = 300`) triggers early refresh.
- On refresh failure, tokens are cleared from `.env.local` to force re-authorization on the next run.

### API Client (`client.ts`)

`StravaClient` is a lightweight REST wrapper around the Strava v3 API.

| Method                  | Endpoint                  | Returns                                         |
| ----------------------- | ------------------------- | ----------------------------------------------- |
| `getProfile()`          | `GET /athlete`            | Name, location, bio, follower/friend counts     |
| `getRecentActivities()` | `GET /athlete/activities` | Last N activities — type, distance, time, speed |

**Built-in resilience:**

- **Auto-retry on 401** — if the API returns `401 Unauthorized`, the client forces a token refresh and retries the request once before failing.

### Auth Helpers (`auth.ts`)

Low-level functions for Strava's OAuth endpoints:

| Function                  | Description                                           |
| ------------------------- | ----------------------------------------------------- |
| `getAuthorizationUrl()`   | Builds the Strava consent page URL with scopes        |
| `exchangeCodeForTokens()` | Exchanges an authorization code for tokens            |
| `refreshTokens()`         | Exchanges a refresh token for new access/refresh pair |

### Ingestion (`index.ts`)

`ingestStrava()` orchestrates the full data pull:

1. Fetches your **athlete profile** and embeds it as a single document
2. Fetches your **last 20 activities** and embeds each as a separate document with metadata (activity type, date, name)
3. Saves raw data to `data/processed/strava.json` for use by the weekly report

Each document is synced via the `EmbeddingPipeline`, which skips re-embedding if the content hasn't changed.

## File Structure

```
strava/
├── auth.ts     # OAuth URL builder + token exchange functions
├── client.ts   # StravaClient — REST wrapper with 401 retry
├── index.ts    # ingestStrava() — fetches & embeds profile + activities
└── token.ts    # Token lifecycle — ensure, refresh, status, save
```

## Required Environment Variables

Set these in `.env.local`:

| Variable               | Description                                   |
| ---------------------- | --------------------------------------------- |
| `STRAVA_CLIENT_ID`     | Your Strava API application client ID         |
| `STRAVA_CLIENT_SECRET` | Your Strava API application client secret     |
| `STRAVA_ACCESS_TOKEN`  | Auto-managed — set after first OAuth flow     |
| `STRAVA_REFRESH_TOKEN` | Auto-managed — set after first OAuth flow     |
| `STRAVA_EXPIRES_AT`    | Auto-managed — Unix timestamp of token expiry |

> **Note:** `STRAVA_ACCESS_TOKEN`, `STRAVA_REFRESH_TOKEN`, and `STRAVA_EXPIRES_AT` are written automatically by the token manager. You only need to manually set `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET`.

## References

- [Strava API v3 Documentation](https://developers.strava.com/docs/reference/)
- [Strava OAuth Authentication](https://developers.strava.com/docs/authentication/)
- [Getting Started with the Strava API](https://developers.strava.com/docs/getting-started/)

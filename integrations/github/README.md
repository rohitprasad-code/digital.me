# GitHub Integration

Connects Digital Me to the [GitHub REST API](https://docs.github.com/en/rest) via [Octokit](https://github.com/octokit/rest.js) to fetch your profile, repositories, and recent activity. Data is embedded into the vector store so the LLM can answer questions about your development work.

## 🛠️ Implementation

### API Client (`client.ts`)

`GitHubClient` wraps Octokit and provides three data-fetching methods:

| Method                 | Octokit Call                         | Returns                                              |
| ---------------------- | ------------------------------------ | ---------------------------------------------------- |
| `getProfile()`         | `users.getByUsername()`              | Login, name, bio, repo count, followers, profile URL |
| `getRecentRepos(n)`    | `repos.listForUser(sort: "updated")` | Top N repos — name, language, stars, description     |
| `getRecentActivity(n)` | `activity.listPublicEventsForUser()` | Last N events — type, repo name, timestamp, payload  |

- Authentication is handled via a **Personal Access Token** (PAT) passed to Octokit on construction.
- All methods return `null` or `[]` on error and log the failure, so ingestion continues gracefully.

### Ingestion (`index.ts`)

`ingestGitHub()` orchestrates the full data pull:

1. **Profile** — embedded as a single document (`github_profile`)
2. **Repositories** — each of the top 5 recently updated repos is embedded as a separate document (`github_repo`) with the repo name as metadata
3. **Activity** — the last 10 public events are combined into a single summary document (`github_activity`)
4. **Raw backup** — all fetched data is saved to `data/processed/github.json` for use by the weekly report

Each document is synced via the `EmbeddingPipeline`, which skips re-embedding if the content hasn't changed.

## File Structure

```
github/
├── client.ts   # GitHubClient — Octokit wrapper with profile, repos & activity methods
└── index.ts    # ingestGitHub() — fetches & embeds all GitHub data
```

## Required Environment Variables

Set these in `.env.local`:

| Variable          | Description                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`    | [Personal Access Token](https://github.com/settings/tokens) with `repo` and `read:user` scopes |
| `GITHUB_USERNAME` | Your GitHub username (used for profile and activity lookups)                                   |

## References

- [GitHub REST API Documentation](https://docs.github.com/en/rest)
- [Octokit REST.js](https://github.com/octokit/rest.js)
- [Creating a Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

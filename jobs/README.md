# Jobs

The `jobs/` module contains background processes and pipelines that run on a schedule or are invoked during ingestion. It handles automated data refresh, document embedding, and weekly report generation.

## Components

### Scheduler (`scheduler.ts`)

A [node-cron](https://github.com/node-cron/node-cron) based scheduler that runs three recurring jobs:

| Job                      | Schedule            | What It Does                                                    |
| ------------------------ | ------------------- | --------------------------------------------------------------- |
| **Data Ingestion**       | Daily at 11:00 PM   | Runs `npm run cli:exec ingest` to re-pull all data sources      |
| **Weekly Report**        | Sundays at 11:50 PM | Runs `npm run cli:exec report` to generate an LLM-based summary |
| **Strava Token Refresh** | Every 5 hours       | Calls `refreshTokenSilently()` to keep the Strava token valid   |

- Strava token refresh is **headless** — it never opens a browser. If no valid tokens exist, it logs a warning and skips.
- The scheduler is started with `npm run scheduler`.

### Embedding Pipeline (`embedding_pipeline.ts`)

`EmbeddingPipeline` is the core class used by all integrations and parsers to embed documents into the vector store **incrementally**.

| Method                    | Purpose                                                                      |
| ------------------------- | ---------------------------------------------------------------------------- |
| `syncDocument()`          | Embeds a document if new/changed, skips if content hash + provider match     |
| `cleanupStaleDocuments()` | Removes documents not seen in the current run or embedded by an old provider |

**How incremental sync works:**

```
Input (content + metadata)
        │
        ▼
  Generate SHA-256 hash
        │
        ▼
  Hash matches existing doc     ──► Skip (no API call)
  with same embedding provider?
        │ No
        ▼
  Call embedding provider
        │
        ▼
  Store in vector store
```

This avoids expensive embedding API calls when data hasn't changed, and also handles **provider switching** — if you switch from Ollama to Gemini, all documents are re-embedded with the new provider.

### Weekly Report (`weekly_report/`)

Generates an LLM-synthesized weekly summary from your GitHub and Strava data.

| File                  | Purpose                                                                   |
| --------------------- | ------------------------------------------------------------------------- |
| `report_generator.ts` | Reads `github.json` + `strava.json`, filters to last 7 days, sends to LLM |
| `index.ts`            | Re-exports `generateWeeklyReport()`                                       |

**Report flow:**

1. Reads cached JSON from `data/processed/` (GitHub activity + Strava activities)
2. Filters to the **last 7 days**
3. Sends the data to the LLM with the `WEEKLY_REPORT_PROMPT` template
4. Saves the generated markdown report to `data/reports/YYYY-MM-DD.md`

## File Structure

```
jobs/
├── scheduler.ts              # Cron scheduler — ingestion, reports, token refresh
├── embedding_pipeline.ts     # Incremental sync with hash-based deduplication
└── weekly_report/
    ├── report_generator.ts   # Reads cached data, calls LLM, saves report
    └── index.ts              # Re-exports generateWeeklyReport()
```

## References

- [node-cron](https://github.com/node-cron/node-cron) — Cron-like task scheduler for Node.js
- [Cron Expression Syntax](https://crontab.guru/) — Visual cron schedule builder

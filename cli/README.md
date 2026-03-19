# CLI — Command-Line Interface

The `cli/` module provides the terminal interface for Digital Me. Use it to chat with your digital twin or ingest data into the vector store.

## Commands

### `chat`

Starts an interactive chat session that streams responses from the API.

```bash
npm run cli chat
```

| Option            | Description                                                                         |
| ----------------- | ----------------------------------------------------------------------------------- |
| `-i, --id <id>`   | Resume a specific chat ID                                                           |
| `-u, --url <url>` | Override the API URL (default: `DIGITAL_ME_API_URL` or `http://localhost:7001/api`) |

- Type your message and press **Enter** to send.
- Type `exit` to quit.

> **Note:** The API server (`npm run dev`) must be running before starting a chat session.

### `ingest`

Runs the full data ingestion pipeline to build / rebuild the vector store.

```bash
npm run cli ingest
```

**Pipeline steps:**

1. Clears the existing vector store
2. Loads data from `public/` directory
3. Fetches GitHub data (profile, repos, recent activity)
4. Fetches Strava data (profile, recent activities)
5. Chunks, embeds, and indexes everything into the vector store

## 🛠️ Implementation

The CLI is built using **Commander.js** to handle command routing, options, and arguments.

- **Interactive Chat**: Implemented as a recursive `readline` loop in `cli/chat.ts`. It makes a `POST` request to the local Next.js API and processes the response as a **ReadableStream**, updating the console output in real-time.
- **Ingestion Pipeline**: Orchestrated by `memory/ingest.ts`. Each integration is called sequentially, passing a global `VectorStore` instance for shared indexing.
- **Environment Management**: Leverages `dotenv` to load secrets from `.env.local`, which are then passed to the API or used directly by integrations during ingestion.
- **Error Handling**: Uses `process.exit(1)` with descriptive error messages to ensure failures in data fetching are clearly communicated to the user.

## File Structure

| File       | Purpose                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------- |
| `index.ts` | CLI entrypoint — defines commands via [Commander.js](https://github.com/tj/commander.js) |
| `chat.ts`  | Chat loop — handles user input, API calls, and response streaming                        |

## Environment Variables

Loaded automatically from `.env.local`:

| Variable              | Used By                              |
| --------------------- | ------------------------------------ |
| `DIGITAL_ME_API_URL`  | `chat` — API endpoint override       |
| `GITHUB_TOKEN`        | `ingest` — GitHub API authentication |
| `GITHUB_USERNAME`     | `ingest` — GitHub profile to fetch   |
| `STRAVA_ACCESS_TOKEN` | `ingest` — Strava API authentication |

## Adding a New Command

1. Create a new file for the command logic (e.g., `stats.ts`)
2. Import it in `index.ts`
3. Register with `program.command('stats')...`

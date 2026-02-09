# Digital Me CLI

The `src/cli` module provides the command-line interface for interacting with the Digital Me system. It allows you to chat with your digital twin and manage the data ingestion process.

## Commands

### `chat`

Starts an interactive chat session with the Digital Me AI.

**Usage:**

```bash
npm run cli chat
# OR
npx ts-node -r tsconfig-paths/register src/cli/index.ts chat
```

**Options:**

- `-u, --url <url>`: Override the API URL (defaults to `http://localhost:3000/api` or `DIGITAL_ME_API_URL` env var).

**Interaction:**

- Type your message and press Enter to send.
- Type `exit` to quit the session.

### `ingest`

Triggers the data ingestion pipeline to update the AI's knowledge base.

**Usage:**

```bash
npm run cli ingest
```

**What it does:**

1.  **Clears Vector Store**: Resets the in-memory vector database.
2.  **Ingests Static Data**: Loads `src/memory/static/me.json` (Profile, Skills, Interests).
3.  **Parses Resume**: Reads `src/memory/static/resume.pdf`, parses text, and uses LLM to structure it into JSON (Education, Experience, Projects).
4.  **Fetches GitHub Data**: Connects to GitHub API (if tokens are present) to fetch your profile, recent repos, and activity.
5.  **Indexes Data**: Chunks and embeds all data into the vector store for retrieval.

## Architecture

The CLI is built using:

- **Commander.js**: for command parsing and routing.
- **Inquirer / Readline**: for interactive input handling.
- **TS-Node**: for running TypeScript directly without a build step.

### File Structure

- `index.ts`: Entry point. Defines commands and options.
- `chat.ts`: Implementation of the chat loop. Handles API communication and response streaming.

## Configuration

The CLI respects the following environment variables (loaded from `.env.local`):

- `DIGITAL_ME_API_URL`: The base URL of the Next.js API (default: `http://localhost:3000/api`).
- `GITHUB_TOKEN`: For the `ingest` command.
- `GITHUB_USERNAME`: For the `ingest` command.

## Development

To add a new command:

1.  Create a new function/file for the command logic.
2.  Import it in `src/cli/index.ts`.
3.  Register it with `program.command('new-command')...`.

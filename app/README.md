# API Routes

The `api/` directory contains the logic that powers Digital Me's API layer. It handles incoming chat requests, orchestrates RAG retrieval, streams LLM responses back to the client, and serves generated reports.

## Routes

### Chat API (`api/chat.ts`)

#### `GET /api/chat`

Health check — verifies the AI backend is reachable.

| Status | Response                                     |
| ------ | -------------------------------------------- |
| `200`  | `Digital-Me is running`                      |
| `503`  | `Service Unavailable: AI Backend is offline` |

#### `POST /api/chat`

Main chat completion endpoint. Accepts conversation history, retrieves relevant context from the vector store, and streams an LLM response.

**Request Body:**

```json
{
  "messages": [
    { "role": "user", "content": "Tell me about your projects" },
    { "role": "assistant", "content": "I've worked on..." }
  ],
  "mode": "default" // Optional: "recruiter", "social", or "default"
}
```

**Response:** Streamed `text/plain; charset=utf-8` — tokens are sent chunk-by-chunk as they are generated.

### Report API (`api/report.ts`)

#### `GET /api/report`

Fetches markdown weekly reports.

**Query Parameters:**

- `date` (YYYY-MM-DD): Fetch a specific report by date.

| Status | Response                                 |
| ------ | ---------------------------------------- |
| `200`  | Markdown content of the report           |
| `404`  | JSON: `{ "error": "No reports found." }` |

#### `POST /api/report`

Generates a new weekly report and returns its markdown content.

| Status | Response                                          |
| ------ | ------------------------------------------------- |
| `200`  | Markdown content of the generated report          |
| `500`  | JSON: `{ "error": "Failed to generate report." }` |

## Request Flow (Chat API)

```
  Client Request
        │
        ▼
┌─────────────────┐
│  Extract last   │
│  user message   │
└───────┬─────────┘
        ▼
┌─────────────────┐
│  VectorStore    │  ← cosine similarity search (top 10)
│  .search()      │
└───────┬─────────┘
        ▼
┌─────────────────┐
│  Build prompt   │  ← System Prompt + Retrieved Context + Chat History
└───────┬─────────┘
        ▼
┌─────────────────┐
│  Provider.chat()│  ← stream: true
└───────┬─────────┘
        ▼
  Streamed Response
```

## 🛠️ Implementation

The API layer is built with **Next.js 15 App Router**, leveraging **Route Handlers** for server-side logic and streaming.

- **Conversation Flow**: Each chat request extracts the last user message, which is then used by the `VectorStore` to perform a cosine similarity search on the latest ingested data.
- **RAG Orchestration**: The retrieved context is injected into a specialized **System Prompt**, along with the full chat history, and passed to the **LLM Provider** (Ollama).
- **Token Streaming**: Uses the `ollama.chat` method with `stream: true`. Chunks are sent to the client as they arrive, providing a smooth, real-time typing effect in the CLI or UI.
- **Report Generation**: The Report API reads pre-processed JSON data from `data/processed/`, filters it by date, and uses the LLM to synthesize a natural language summary.

## File Structure

| File        | Purpose                                                         |
| ----------- | --------------------------------------------------------------- |
| `chat.ts`   | API route handler — `GET` health check + `POST` chat completion |
| `report.ts` | API route handler — `GET` user reports + `POST` generate report |

## Notes

- The API defaults to assuming Ollama or the selected LLM provider is running correctly.
- The vector store is loaded from disk on each request in the chat API.
- **No authentication** is implemented out of the box — this is designed for local use. Add API key verification before any public deployment.

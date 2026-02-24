# App — Next.js Backend

The `app/` directory contains the Next.js application that powers Digital Me's API layer. It handles incoming chat requests, orchestrates RAG retrieval, and streams LLM responses back to the client.

## API Routes

All routes are served under `/api`.

### `GET /api`

Health check — verifies the Ollama backend is reachable.    

| Status | Response                                     |
| ------ | -------------------------------------------- |
| `200`  | `Digital-Me is running`                      |
| `503`  | `Service Unavailable: AI Backend is offline` |

### `POST /api`

Main chat completion endpoint. Accepts conversation history, retrieves relevant context from the vector store, and streams an LLM response.

**Request Body:**

```json
{
  "messages": [
    { "role": "user", "content": "Tell me about your projects" },
    { "role": "assistant", "content": "I've worked on..." }
  ]
}
```

**Response:** Streamed `text/plain` — tokens are sent chunk-by-chunk as they are generated.

### Request Flow

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
│  Ollama .chat() │  ← stream: true
│  (llama3)       │
└───────┬─────────┘
        ▼
 Streamed Response
```

## File Structure

| File           | Purpose                                                         |
| -------------- | --------------------------------------------------------------- |
| `api/route.ts` | API route handler — `GET` health check + `POST` chat completion |
| `globals.css`  | Global styles                                                   |
| `route.ts`     | Root route                                                      |

## Notes

- The API assumes Ollama is running locally on port `11434`.
- The vector store is loaded from disk on each request and shared with the ingestion pipeline.
- **No authentication** is implemented — this is designed for local use. Add API key verification before any public deployment.

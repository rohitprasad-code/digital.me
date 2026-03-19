# Neon Serverless Postgres Setup Guide

This document outlines the architecture and implementation details for setting up a production-ready Retrieval-Augmented Generation (RAG) database using [Neon Serverless Postgres](https://neon.tech) and `pgvector`. This setup natively supports hybrid retrieval (relational metadata + vector similarity) and uses content hashing to prevent duplicate chunk insertions.

## 1. Connection Setup

You can connect to your Neon database using the lightweight `postgres` (postgres.js) library, which natively supports Neon's requirement for SSL connections.

### Environment Variable
Add your Neon connection string to `.env` (ensure `sslmode=require` is present at the end):
```env
DATABASE_URL="postgres://<user>:<password>@<project-name>.<region>.aws.neon.tech/neondb?sslmode=require"
```

### Connection Initialization (TypeScript / Node.js)
```typescript
import postgres from 'postgres';

// Initialize the Postgres connection
const sql = postgres(process.env.DATABASE_URL as string);

async function testConnection() {
  const [{ version }] = await sql`SELECT version()`;
  console.log('Connected to Neon:', version);
}
testConnection();
```

## 2. Schema and Indexes

This step enables the `pgvector` extension and creates a unified table for your document chunks. Note the `content_hash` column and its `UNIQUE` constraint, which forces deduplication.

```sql
-- 1. Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the primary table for RAG documents
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- File or Document Source
    file_path TEXT NOT NULL,
    
    -- Content Details
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL, -- SHA-256 hash to prevent duplicate inserts
    
    -- Metadata (for hybrid filtering, e.g. document_type, dates, summaries)
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Vector Embeddings (1536 dimensions for OpenAI's text-embedding-3-small)
    embedding VECTOR(1536),
    
    -- 3. Unique Constraint to enforce deduplication
    CONSTRAINT unique_content_hash UNIQUE (content_hash)
);

-- 4. Index for fast vector similarity search (HNSW index)
CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- 5. Index for fast JSONB metadata filtering
CREATE INDEX metadata_gin_idx ON document_chunks USING GIN (metadata);
```

## 3. Data Insertion (With Deduplication)

To prevent duplicate document embeddings, we hash the chunk text (`content_hash`) before saving. We then use an Upsert (`ON CONFLICT (content_hash) DO NOTHING`) to safely ignore the insert if the hash already exists.

```typescript
import crypto from 'crypto';

interface DocumentInsertPayload {
  filePath: string;
  content: string;
  metadata: Record<string, any>;
  embedding: number[];
}

export async function addDocumentWithDeduplication(doc: DocumentInsertPayload) {
  // 1. Generate a SHA-256 hash of the content string
  const contentHash = crypto.createHash('sha256').update(doc.content).digest('hex');

  // 2. Insert into Neon Postgres with ON CONFLICT resolution
  try {
    await sql`
      INSERT INTO document_chunks (
        file_path, 
        content, 
        content_hash, 
        metadata, 
        embedding
      )
      VALUES (
        ${doc.filePath}, 
        ${doc.content}, 
        ${contentHash}, 
        ${doc.metadata}, 
        ${doc.embedding}
      )
      ON CONFLICT (content_hash) DO NOTHING;
    `;
    console.log('Chunk added (or ignored if duplicate hash found).');
  } catch (error) {
    console.error('Failed to insert document chunk:', error);
  }
}
```

## 4. Hybrid Query Retrieval

When processing a user query, we combine relational SQL (Metadata Filtering filter, e.g., only looking at specific document types) with Vector Similarity Search.

```typescript
export async function hybridSearch(queryEmbedding: number[], filterType: string, limit: number = 3) {
  // Use Neon's `<=>` operator for Cosine Distance. 
  // We subtract the distance from 1 to get a 0-1 Similarity Score.
  const results = await sql`
    SELECT 
        id,
        file_path, 
        content, 
        metadata,
        1 - (embedding <=> ${queryEmbedding}) AS similarity_score
    FROM document_chunks
    WHERE 
        -- Relational Metadata Filtering -> filter inside the JSONB structure
        metadata->>'document_type' = ${filterType}
    ORDER BY 
        -- Vector Cosine Distance
        embedding <=> ${queryEmbedding}
    LIMIT ${limit};
  `;
  
  return results;
}
```

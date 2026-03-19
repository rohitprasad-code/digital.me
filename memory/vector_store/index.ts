import { getEmbeddingProvider } from "@/model/llm/embeddings";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import postgres from "postgres";

export interface Document {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
}

let sql: postgres.Sql;

function getDb() {
  if (!sql) {
    if (!process.env.DATABASE_URL) {
      console.warn(
        "WARNING: DATABASE_URL is not set. VectorStore requires Neon Postgres to function.",
      );
    }
    const dbUrl = (process.env.DATABASE_URL || "").replace(/^['"]|['"]$/g, "");
    sql = postgres(dbUrl, { ssl: "require" });
  }
  return sql;
}

export class VectorStore {
  constructor() {
    // Ignored as we now use Neon Postgres securely
  }

  async getAllDocuments(): Promise<Document[]> {
    const db = getDb();
    try {
      const rows = await db`SELECT id, content, metadata FROM document_chunks`;
      return rows.map((row) => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata,
      }));
    } catch (e) {
      console.error("Failed to get all documents:", e);
      return [];
    }
  }

  setDocuments() {
    console.warn(
      "setDocuments is deprecated for Neon Postgres. Use deleteDocuments or addDocument instead.",
    );
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = getDb();
    try {
      await db`DELETE FROM document_chunks WHERE id IN ${db(ids)}`;
    } catch (e) {
      console.error("Failed to delete documents:", e);
    }
  }

  async deleteStaleDocuments(daysStale: number, providerName: string): Promise<number> {
    const db = getDb();
    try {
      const result = await db`
        DELETE FROM document_chunks 
        WHERE last_updated_at < NOW() - (${daysStale} * INTERVAL '1 day')
        RETURNING id
      `;
      return result.length;
    } catch (e) {
      console.error("Failed to delete stale documents:", e);
      return 0;
    }
  }

  async addDocumentWithEmbedding(
    content: string,
    embedding: number[],
    metadata: Record<string, unknown> = {},
  ): Promise<Document> {
    const db = getDb();
    const id = uuidv4();
    const contentHash =
      (metadata._contentHash as string) ||
      crypto.createHash("sha256").update(content).digest("hex");
    
    metadata._contentHash = contentHash;

    let filePath = "unknown";
    const source = metadata.source as string;
    if (source) {
      if (["github", "linkedin", "strava"].includes(source.toLowerCase())) {
        filePath = `api://${source.toLowerCase()}/${metadata.type || "data"}`;
      } else {
        filePath = `file://${source}`;
      }
    } else {
      filePath =
        (metadata.filePath as string) || (metadata.path as string) || "unknown";
    }

    try {
      await db`
        INSERT INTO document_chunks (id, file_path, content, metadata, embedding)
        VALUES (${id}, ${filePath}, ${content}, ${JSON.stringify(metadata)}::jsonb, ${JSON.stringify(embedding)}::vector)
        ON CONFLICT ((metadata->>'_contentHash')) 
        DO UPDATE SET last_updated_at = NOW()
      `;
    } catch (error) {
      console.error("Failed to insert document into Neon:", error);
    }

    return { id, content, metadata, embedding };
  }

  async addDocument(
    content: string,
    metadata: Record<string, unknown> = {},
  ): Promise<Document> {
    const embeddingProvider = getEmbeddingProvider();
    const embedding = await embeddingProvider.embed(content);

    return this.addDocumentWithEmbedding(content, embedding, metadata);
  }

  async search(
    query: string,
    limit: number = 3,
  ): Promise<{ doc: Document; score: number }[]> {
    const db = getDb();
    const embeddingProvider = getEmbeddingProvider();
    const queryEmbedding = await embeddingProvider.embed(query);

    try {
      const rows = await db`
        SELECT 
          id, 
          content, 
          metadata, 
          1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) AS score
        FROM document_chunks
        ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${limit}
      `;

      return rows.map((row) => ({
        doc: {
          id: row.id,
          content: row.content,
          metadata: row.metadata,
        },
        score: parseFloat(row.score),
      }));
    } catch (error) {
      console.error("Search failed in Neon:", error);
      return [];
    }
  }

  async save(): Promise<void> {
    // No-op for Postgres
  }

  async load(): Promise<void> {
    const db = getDb();
    console.log("Initializing Neon Postgres Vector Store schemas...");
    try {
      await db`CREATE EXTENSION IF NOT EXISTS vector;`;
      await db`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          file_path TEXT NOT NULL DEFAULT 'unknown',
          content TEXT NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}',
          embedding VECTOR(768),
          last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;
      // Safely create indexes
      await db`CREATE UNIQUE INDEX IF NOT EXISTS document_chunks_content_hash_idx ON document_chunks ((metadata->>'_contentHash'));`;
      await db`CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops);`;
      await db`CREATE INDEX IF NOT EXISTS document_chunks_metadata_idx ON document_chunks USING GIN (metadata);`;
      console.log("Vector store successfully initialized.");
    } catch (error) {
      console.error("Failed to initialize database schema:", error);
    }
  }

  async clear(): Promise<void> {
    const db = getDb();
    try {
      await db`TRUNCATE TABLE document_chunks;`;
      console.log("Vector store cleared.");
    } catch (error) {
      console.error("Failed to clear vector store:", error);
    }
  }
}

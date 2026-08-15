import { getEmbeddingProvider } from "../../../model/providers/embeddings";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import postgres from "postgres";
import { Document, VectorSearchFilter, HallucinationLog } from "../types";

let sql: postgres.Sql;

function getDb() {
  if (!sql) {
    const dbUrl = (process.env.DATABASE_URL || "").replace(/^['"]|['"]$/g, "");
    sql = postgres(dbUrl, {
      ssl: "require",
      max: 10,
      idle_timeout: 15,
    });
  }
  return sql;
}

export class PostgresVectorStore {
  constructor() {}

  async getAllDocuments(): Promise<Document[]> {
    const db = getDb();
    try {
      const rows =
        await db`SELECT id, file_path, content, metadata, last_updated_at, occurred_at FROM document_chunks`;
      return rows.map((row) => ({
        id: row.id,
        filePath: row.file_path,
        content: row.content,
        metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
        lastUpdatedAt: row.last_updated_at,
        occurredAt: row.occurred_at,
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

  async deleteStaleDocuments(daysStale: number): Promise<number> {
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

  async addDocumentsWithEmbeddings(
    documents: { content: string; embedding: number[]; metadata: Record<string, unknown> }[]
  ): Promise<Document[]> {
    if (documents.length === 0) return [];
    const db = getDb();

    const preparedDocs = documents.map((doc) => {
      const id = uuidv4();
      const contentHash =
        (doc.metadata._contentHash as string) ||
        crypto.createHash("sha256").update(doc.content).digest("hex");

      const metadata: Record<string, unknown> = { ...doc.metadata, _contentHash: contentHash };

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

      const occurredAtVal = metadata.occurredAt
        ? new Date(metadata.occurredAt as string | Date)
        : new Date();

      return {
        id,
        filePath,
        content: doc.content,
        metadata,
        embedding: doc.embedding,
        occurredAt: occurredAtVal,
      };
    });

    try {
      await db`
        INSERT INTO document_chunks (id, file_path, content, metadata, embedding, occurred_at)
        VALUES ${db(
          preparedDocs.map((doc) => [
            doc.id,
            doc.filePath,
            doc.content,
            JSON.stringify(doc.metadata),
            JSON.stringify(doc.embedding),
            doc.occurredAt.toISOString(),
          ])
        )}
        ON CONFLICT ((metadata->>'_contentHash')) 
        DO UPDATE SET last_updated_at = NOW(), occurred_at = EXCLUDED.occurred_at
      `;
    } catch (error) {
      console.error("Failed to insert batch of documents into Neon:", error);
    }

    return preparedDocs.map((d) => ({
      id: d.id,
      filePath: d.filePath,
      content: d.content,
      metadata: d.metadata,
      lastUpdatedAt: new Date(),
      occurredAt: d.occurredAt,
    }));
  }

  async addDocumentWithEmbedding(
    content: string,
    embedding: number[],
    metadata: Record<string, unknown> = {},
    _autoSave?: boolean,
  ): Promise<Document> {
    void _autoSave;
    const results = await this.addDocumentsWithEmbeddings([{ content, embedding, metadata }]);
    return results[0];
  }

  async addDocument(
    content: string,
    metadata: Record<string, unknown> = {},
    autoSave: boolean = true,
  ): Promise<Document> {
    const embeddingProvider = getEmbeddingProvider();
    const embedding = await embeddingProvider.embed(content);
    return this.addDocumentWithEmbedding(content, embedding, metadata, autoSave);
  }

  private async pureVectorSearch(
    queryEmbedding: number[],
    limit: number,
    filter?: VectorSearchFilter,
  ): Promise<{ doc: Document; score: number }[]> {
    const db = getDb();

    const categoryVal = filter?.category
      ? (Array.isArray(filter.category) ? filter.category : [filter.category])
      : null;
    const hasCategory = !!categoryVal;

    const excludeCategories = filter?.excludeCategory && filter.excludeCategory.length > 0
      ? filter.excludeCategory
      : null;
    const hasExclude = !!excludeCategories;

    const extraFilters: Record<string, unknown> = {};
    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        if (key !== "category" && key !== "excludeCategory") {
          extraFilters[key] = value;
        }
      }
    }
    const hasExtra = Object.keys(extraFilters).length > 0;
    const extraFiltersJson = hasExtra ? JSON.stringify(extraFilters) : "{}";

    try {
      const rows = await db`
        SELECT 
          id, 
          file_path,
          content, 
          metadata, 
          last_updated_at,
          occurred_at,
          1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) AS score
        FROM document_chunks
        WHERE 
          (${hasCategory} = FALSE OR metadata->>'category' = ANY(${categoryVal}))
          AND (${hasExclude} = FALSE OR metadata->>'category' IS NULL OR NOT (metadata->>'category' = ANY(${excludeCategories})))
          AND (${hasExtra} = FALSE OR metadata @> ${extraFiltersJson}::jsonb)
          AND (${!hasCategory && !hasExclude} = FALSE OR metadata->>'category' IS NULL OR metadata->>'category' != 'system')
        ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${limit}
      `;

      return rows.map((row) => ({
        doc: {
          id: row.id,
          filePath: row.file_path,
          content: row.content,
          metadata: row.metadata,
          lastUpdatedAt: row.last_updated_at,
          occurredAt: row.occurred_at,
        },
        score: parseFloat(row.score),
      }));
    } catch (e) {
      console.error("Failed pure vector search:", e);
      return [];
    }
  }

  async search(
    query: string,
    limit: number = 3,
    filter?: VectorSearchFilter,
  ): Promise<{ doc: Document; score: number }[]> {
    const db = getDb();
    const embeddingProvider = getEmbeddingProvider();
    const queryEmbedding = await embeddingProvider.embed(query);

    try {
      const cleanQuery = query.replace(/[^\w\s-]/g, " ").trim();
      if (!cleanQuery) {
        return this.pureVectorSearch(queryEmbedding, limit, filter);
      }

      const categoryVal = filter?.category
        ? (Array.isArray(filter.category) ? filter.category : [filter.category])
        : null;
      const hasCategory = !!categoryVal;

      const excludeCategories = filter?.excludeCategory && filter.excludeCategory.length > 0
        ? filter.excludeCategory
        : null;
      const hasExclude = !!excludeCategories;

      const extraFilters: Record<string, unknown> = {};
      if (filter) {
        for (const [key, value] of Object.entries(filter)) {
          if (key !== "category" && key !== "excludeCategory") {
            extraFilters[key] = value;
          }
        }
      }
      const hasExtra = Object.keys(extraFilters).length > 0;
      const extraFiltersJson = hasExtra ? JSON.stringify(extraFilters) : "{}";

      const rows = await db`
        WITH vector_search AS (
          SELECT 
            id, 
            row_number() OVER (ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector) AS rank
          FROM document_chunks
          WHERE 
            (${hasCategory} = FALSE OR metadata->>'category' = ANY(${categoryVal}))
            AND (${hasExclude} = FALSE OR metadata->>'category' IS NULL OR NOT (metadata->>'category' = ANY(${excludeCategories})))
            AND (${hasExtra} = FALSE OR metadata @> ${extraFiltersJson}::jsonb)
            AND (${!hasCategory && !hasExclude} = FALSE OR metadata->>'category' IS NULL OR metadata->>'category' != 'system')
          ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
          LIMIT ${limit * 4}
        ),
        text_search AS (
          SELECT 
            id, 
            row_number() OVER (ORDER BY ts_rank_cd(to_tsvector('english', content), websearch_to_tsquery('english', ${cleanQuery})) DESC) AS rank
          FROM document_chunks
          WHERE 
            (${hasCategory} = FALSE OR metadata->>'category' = ANY(${categoryVal}))
            AND (${hasExclude} = FALSE OR metadata->>'category' IS NULL OR NOT (metadata->>'category' = ANY(${excludeCategories})))
            AND (${hasExtra} = FALSE OR metadata @> ${extraFiltersJson}::jsonb)
            AND (${!hasCategory && !hasExclude} = FALSE OR metadata->>'category' IS NULL OR metadata->>'category' != 'system')
            AND to_tsvector('english', content) @@ websearch_to_tsquery('english', ${cleanQuery})
          ORDER BY ts_rank_cd(to_tsvector('english', content), websearch_to_tsquery('english', ${cleanQuery})) DESC
          LIMIT ${limit * 4}
        )
        SELECT 
          dc.id, 
          dc.file_path, 
          dc.content, 
          dc.metadata, 
          dc.last_updated_at,
          dc.occurred_at,
          COALESCE(1.0 / (60.0 + vs.rank), 0.0) + COALESCE(1.0 / (60.0 + ts.rank), 0.0) AS score
        FROM document_chunks dc
        LEFT JOIN vector_search vs ON dc.id = vs.id
        LEFT JOIN text_search ts ON dc.id = ts.id
        WHERE vs.id IS NOT NULL OR ts.id IS NOT NULL
        ORDER BY score DESC
        LIMIT ${limit}
      `;

      return rows.map((row) => ({
        doc: {
          id: row.id,
          filePath: row.file_path,
          content: row.content,
          metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
          lastUpdatedAt: row.last_updated_at,
          occurredAt: row.occurred_at,
        },
        score: parseFloat(row.score),
      }));
    } catch (error) {
      console.warn("Hybrid search (RRF) failed, falling back to vector search:", error);
      return this.pureVectorSearch(queryEmbedding, limit, filter);
    }
  }

  async save(): Promise<void> {
    // No-op for Postgres
  }

  async load(): Promise<void> {
    const db = getDb();
    console.log("Initializing Neon Postgres Vector Store schemas...");
    try {
      let dimension = 768;
      try {
        const embeddingProvider = getEmbeddingProvider();
        const testVector = await embeddingProvider.embed("dimension_detection_ping");
        if (testVector && testVector.length > 0) {
          dimension = testVector.length;
          console.log(`Auto-detected embedding dimension: ${dimension}`);
        }
      } catch (err) {
        console.warn("Failed to auto-detect embedding dimensions, falling back to default (768):", err);
      }

      await db`CREATE EXTENSION IF NOT EXISTS vector;`;
      
      // Use unsafe raw query because the dimension parameter must be interpolated structurally
      await db.unsafe(`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          file_path TEXT NOT NULL DEFAULT 'unknown',
          content TEXT NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}',
          embedding VECTOR(${dimension}),
          last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // Create hallucination logs table
      await db`
        CREATE TABLE IF NOT EXISTS hallucination_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          query TEXT NOT NULL,
          response TEXT NOT NULL,
          is_safe BOOLEAN NOT NULL,
          feedback TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          corrected BOOLEAN DEFAULT FALSE
        );
      `;

      await db`CREATE UNIQUE INDEX IF NOT EXISTS document_chunks_content_hash_idx ON document_chunks ((metadata->>'_contentHash'));`;
      await db`CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops);`;
      await db`CREATE INDEX IF NOT EXISTS document_chunks_metadata_idx ON document_chunks USING GIN (metadata);`;
      await db`CREATE INDEX IF NOT EXISTS document_chunks_occurred_at_idx ON document_chunks (occurred_at DESC);`;
      await db`CREATE INDEX IF NOT EXISTS document_chunks_content_fts_idx ON document_chunks USING gin(to_tsvector('english', content));`;
      console.log("Vector store successfully initialized.");
    } catch (error) {
      console.error("Failed to initialize database schema:", error);
    }
  }

  async logHallucination(
    query: string,
    response: string,
    isSafe: boolean,
    feedback?: string,
  ): Promise<void> {
    const db = getDb();
    try {
      await db`
        INSERT INTO hallucination_logs (query, response, is_safe, feedback)
        VALUES (${query}, ${response}, ${isSafe}, ${feedback || null})
      `;
    } catch (error) {
      console.error("Failed to log hallucination check to Neon Postgres:", error);
    }
  }

  async getHallucinations(): Promise<HallucinationLog[]> {
    const db = getDb();
    try {
      const rows = await db`
        SELECT id, query, response, is_safe as "isSafe", feedback, created_at as "createdAt", corrected
        FROM hallucination_logs
        ORDER BY created_at DESC
      `;
      return rows.map((row) => ({
        id: row.id,
        query: row.query,
        response: row.response,
        isSafe: row.isSafe,
        feedback: row.feedback,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        corrected: !!row.corrected,
      }));
    } catch (e) {
      console.error("Failed to fetch hallucination logs from Neon Postgres:", e);
      return [];
    }
  }

  async markHallucinationCorrected(id: string): Promise<void> {
    const db = getDb();
    try {
      await db`
        UPDATE hallucination_logs
        SET corrected = TRUE
        WHERE id = ${id}
      `;
    } catch (error) {
      console.error("Failed to mark hallucination corrected in Neon Postgres:", error);
    }
  }

  async getDocumentsByTimeRange(
    startDate: Date,
    endDate: Date,
  ): Promise<Document[]> {
    const db = getDb();
    try {
      const rows = await db`
        SELECT id, file_path, content, metadata, last_updated_at, occurred_at 
        FROM document_chunks 
        WHERE occurred_at >= ${startDate} AND occurred_at <= ${endDate}
      `;
      return rows.map((row) => ({
        id: row.id,
        filePath: row.file_path,
        content: row.content,
        metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
        lastUpdatedAt: row.last_updated_at,
        occurredAt: row.occurred_at,
      }));
    } catch (error) {
      console.error("Failed to get documents by time range from Postgres:", error);
      return [];
    }
  }

  async clear(): Promise<void> {
    const db = getDb();
    try {
      await db`TRUNCATE TABLE document_chunks;`;
      await db`TRUNCATE TABLE hallucination_logs;`;
      console.log("Vector store cleared.");
    } catch (error) {
      console.error("Failed to clear vector store:", error);
    }
  }

  async close(): Promise<void> {
    if (sql) {
      await sql.end();
      sql = undefined as unknown as postgres.Sql;
      console.log("Neon Postgres Vector Store connection pool ended.");
    }
  }
}

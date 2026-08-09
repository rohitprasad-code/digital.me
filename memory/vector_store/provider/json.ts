import { getEmbeddingProvider } from "../../../model/providers/embeddings";
import computeCosineSimilarity from "compute-cosine-similarity";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { VECTOR_DIR } from "../../../utils/paths";
import { Document, VectorSearchFilter, MemoryCategory, HallucinationLog } from "../types";

export class JsonVectorStore {
  private documents: Document[] = [];
  private readonly storageFile: string;
  private lastMTimeMs: number = 0;
  private saveQueue: Promise<void> = Promise.resolve();

  constructor(storageFile: string = "embedded_vectors.json") {
    this.storageFile = path.join(VECTOR_DIR, storageFile);
  }

  async getAllDocuments(): Promise<Document[]> {
    return this.documents;
  }

  setDocuments(docs: Document[]) {
    this.documents = docs;
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    this.documents = this.documents.filter((doc) => !idSet.has(doc.id));
    await this.save();
  }

  async deleteStaleDocuments(daysStale: number): Promise<number> {
    const now = Date.now();
    const staleMs = daysStale * 24 * 60 * 60 * 1000;

    let removedCount = 0;
    this.documents = this.documents.filter((doc) => {
      const lastUpdatedMs = doc.lastUpdatedAt
        ? new Date(doc.lastUpdatedAt).getTime()
        : parseFloat((doc.metadata?._lastUpdatedAt as string) || "0");
      if (lastUpdatedMs > 0 && now - lastUpdatedMs > staleMs) {
        removedCount++;
        return false; // delete
      }
      return true; // keep
    });

    if (removedCount > 0) {
      await this.save();
    }
    return removedCount;
  }

  async addDocumentWithEmbedding(
    content: string,
    embedding: number[],
    metadata: Record<string, unknown> = {},
    autoSave: boolean = true,
  ): Promise<Document> {
    const contentHash =
      (metadata._contentHash as string) ||
      crypto.createHash("sha256").update(content).digest("hex");

    metadata._contentHash = contentHash;
    const strTimestamp = new Date().toISOString();
    metadata._lastUpdatedAt = Date.now().toString(); // retain backward compatibility

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
      ? new Date(metadata.occurredAt as string | Date).toISOString()
      : strTimestamp;

    // Local array deduplication simulating the postgres conflict resolution GC metrics
    const existingIndex = this.documents.findIndex(
      (d) => d.metadata?._contentHash === contentHash,
    );
    if (existingIndex !== -1) {
      this.documents[existingIndex].lastUpdatedAt = strTimestamp;
      this.documents[existingIndex].occurredAt = occurredAtVal;
      this.documents[existingIndex].metadata._lastUpdatedAt =
        metadata._lastUpdatedAt;
      if (autoSave) {
        await this.save();
      }
      return this.documents[existingIndex];
    }

    const doc: Document = {
      id: uuidv4(),
      filePath,
      content,
      metadata,
      embedding,
      lastUpdatedAt: strTimestamp,
      occurredAt: occurredAtVal,
    };

    this.documents.push(doc);
    if (autoSave) {
      await this.save();
    }
    return doc;
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

  async search(
    query: string,
    limit: number = 3,
    filter?: VectorSearchFilter,
  ): Promise<{ doc: Document; score: number }[]> {
    const embeddingProvider = getEmbeddingProvider();
    const queryEmbedding = await embeddingProvider.embed(query);

    let docsToSearch = this.documents;

    if (filter) {
      if (filter.category) {
        const allowedCategories = Array.isArray(filter.category)
          ? filter.category
          : [filter.category];
        docsToSearch = docsToSearch.filter((doc) =>
          allowedCategories.includes(doc.metadata?.category as MemoryCategory),
        );
      }

      if (filter.excludeCategory && filter.excludeCategory.length > 0) {
        docsToSearch = docsToSearch.filter(
          (doc) =>
            !filter.excludeCategory!.includes(
              doc.metadata?.category as MemoryCategory,
            ),
        );
      }

      if (filter.source) {
        docsToSearch = docsToSearch.filter(
          (doc) => doc.metadata?.source === filter.source,
        );
      }
    } else {
      // By default exclude system internal documents from query context
      docsToSearch = docsToSearch.filter((doc) => doc.metadata?.category !== "system");
    }

    const scoredDocs = docsToSearch.map((doc) => {
      if (!doc.embedding) return { doc, score: -1 };
      const score =
        computeCosineSimilarity(queryEmbedding, doc.embedding) || -1;
      return { doc, score };
    });

    scoredDocs.sort((a, b) => b.score - a.score);
    return scoredDocs.slice(0, limit);
  }

  async save(): Promise<void> {
    // Chain onto the write queue to serialize all concurrent save operations
    this.saveQueue = this.saveQueue.then(async () => {
      try {
        await fs.mkdir(path.dirname(this.storageFile), { recursive: true });
        
        // Write to a temporary file in the same directory
        const tempPath = `${this.storageFile}.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await fs.writeFile(
          tempPath,
          JSON.stringify(this.documents, null, 2),
        );
        
        // Perform atomic rename to overwrite the target file safely
        await fs.rename(tempPath, this.storageFile);
        
        const stats = await fs.stat(this.storageFile).catch(() => null);
        if (stats) {
          this.lastMTimeMs = stats.mtimeMs;
        }
      } catch (error) {
        console.error("Failed to save vector store:", error);
      }
    });
    return this.saveQueue;
  }

  async load(): Promise<void> {
    try {
      const stats = await fs.stat(this.storageFile).catch(() => null);
      if (!stats) {
        console.log("Vector store file not found, starting empty.");
        this.documents = [];
        this.lastMTimeMs = 0;
        return;
      }

      if (stats.mtimeMs <= this.lastMTimeMs && this.documents.length > 0) {
        // Cached version is up to date, skip reading
        return;
      }

      console.log("Loading vector store from:", this.storageFile);
      const data = await fs.readFile(this.storageFile, "utf-8");
      this.documents = JSON.parse(data);
      this.lastMTimeMs = stats.mtimeMs;
      console.log(`Loaded ${this.documents.length} local JSON documents.`);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        console.log("Vector store file not found, starting empty.");
        this.documents = [];
        this.lastMTimeMs = 0;
      } else {
        console.error("Failed to load vector store:", error);
        throw error;
      }
    }
  }

  async logHallucination(
    query: string,
    response: string,
    isSafe: boolean,
    feedback?: string,
  ): Promise<void> {
    try {
      const logFile = path.join(VECTOR_DIR, "hallucination_logs.json");
      let logs = [];
      try {
        const data = await fs.readFile(logFile, "utf-8");
        logs = JSON.parse(data);
      } catch {
        // Ignore and start with empty array
      }
      logs.push({
        id: uuidv4(),
        query,
        response,
        isSafe,
        feedback: feedback || null,
        createdAt: new Date().toISOString(),
      });
      await fs.writeFile(logFile, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error("Failed to log hallucination check to local JSON:", error);
    }
  }

  async getHallucinations(): Promise<HallucinationLog[]> {
    try {
      const logFile = path.join(VECTOR_DIR, "hallucination_logs.json");
      const data = await fs.readFile(logFile, "utf-8");
      const logs = JSON.parse(data);
      return Array.isArray(logs) ? logs.reverse() : [];
    } catch {
      return [];
    }
  }

  async markHallucinationCorrected(id: string): Promise<void> {
    try {
      const logFile = path.join(VECTOR_DIR, "hallucination_logs.json");
      const data = await fs.readFile(logFile, "utf-8");
      const logs = JSON.parse(data);
      if (Array.isArray(logs)) {
        const index = logs.findIndex((log: HallucinationLog) => log.id === id);
        if (index !== -1) {
          logs[index].corrected = true;
          await fs.writeFile(logFile, JSON.stringify(logs, null, 2));
        }
      }
    } catch (error) {
      console.error("Failed to mark hallucination corrected in local JSON:", error);
    }
  }

  async getDocumentsByTimeRange(
    startDate: Date,
    endDate: Date,
  ): Promise<Document[]> {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    return this.documents.filter((doc) => {
      const occurredMs = doc.occurredAt ? new Date(doc.occurredAt).getTime() : 0;
      return occurredMs >= startMs && occurredMs <= endMs;
    });
  }

  async clear(): Promise<void> {
    this.documents = [];
    await this.save();
    const logFile = path.join(VECTOR_DIR, "hallucination_logs.json");
    await fs.unlink(logFile).catch(() => {});
  }
}

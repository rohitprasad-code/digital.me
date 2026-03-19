import { getEmbeddingProvider } from "@/model/llm/embeddings";
import computeCosineSimilarity from "compute-cosine-similarity";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { VECTOR_DIR } from "@/utils/paths";
import { Document } from "../types";

export class JsonVectorStore {
  private documents: Document[] = [];
  private readonly storageFile: string;

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

    // Local array deduplication simulating the postgres conflict resolution GC metrics
    const existingIndex = this.documents.findIndex(
      (d) => d.metadata?._contentHash === contentHash,
    );
    if (existingIndex !== -1) {
      this.documents[existingIndex].lastUpdatedAt = strTimestamp;
      this.documents[existingIndex].metadata._lastUpdatedAt =
        metadata._lastUpdatedAt;
      await this.save();
      return this.documents[existingIndex];
    }

    const doc: Document = {
      id: uuidv4(),
      filePath,
      content,
      metadata,
      embedding,
      lastUpdatedAt: strTimestamp,
    };

    this.documents.push(doc);
    await this.save();
    return doc;
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
    const embeddingProvider = getEmbeddingProvider();
    const queryEmbedding = await embeddingProvider.embed(query);

    const scoredDocs = this.documents.map((doc) => {
      if (!doc.embedding) return { doc, score: -1 };
      const score =
        computeCosineSimilarity(queryEmbedding, doc.embedding) || -1;
      return { doc, score };
    });

    scoredDocs.sort((a, b) => b.score - a.score);
    return scoredDocs.slice(0, limit);
  }

  async save(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.storageFile), { recursive: true });
      await fs.writeFile(
        this.storageFile,
        JSON.stringify(this.documents, null, 2),
      );
    } catch (error) {
      console.error("Failed to save vector store:", error);
    }
  }

  async load(): Promise<void> {
    try {
      console.log("Loading vector store from:", this.storageFile);
      const data = await fs.readFile(this.storageFile, "utf-8");
      this.documents = JSON.parse(data);
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
      } else {
        console.error("Failed to load vector store:", error);
        throw error;
      }
    }
  }

  async clear(): Promise<void> {
    this.documents = [];
    await this.save();
  }
}

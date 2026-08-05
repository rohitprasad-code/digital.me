import crypto from "crypto";
import { VectorStore, Document } from "../memory/vector_store";
import { getEmbeddingProvider } from "../model/providers/embeddings";
import { log } from "../utils/logger";

export class EmbeddingPipeline {
  private vectorStore: VectorStore;
  private currentProvider: string;
  private seenContentHashes: Set<string>;
  private allDocsCache: Document[] | null = null;

  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore;
    this.currentProvider = (process.env.LLM_PROVIDER || "ollama").toLowerCase();
    this.seenContentHashes = new Set<string>();
  }

  private async getAllDocs(): Promise<Document[]> {
    if (!this.allDocsCache) {
      this.allDocsCache = await this.vectorStore.getAllDocuments();
    }
    return this.allDocsCache;
  }

  /**
   * Generates a unique hash for a document's content and metadata
   */
  private generateHash(input: string, metadata: Record<string, unknown>): string {
    const dataString = input + JSON.stringify(metadata);
    return crypto.createHash("sha256").update(dataString).digest("hex");
  }

  /**
   * Syncs a single document incrementally.
   * If the content/metadata hash and the embedding provider match an existing document,
   * it skips the expensive embedding API call.
   */
  async syncDocument(
    content: string,
    metadata: Record<string, unknown> = {},
    rawSource?: string,
  ): Promise<Document | null> {
    const inputForHashing = rawSource || content;
    const contentHash = this.generateHash(inputForHashing, metadata);

    // We attach the provider, category, and hash to the metadata for tracking
    const enrichedMetadata = {
      category: metadata.category || "static",
      ...metadata,
      _contentHash: contentHash,
      _embeddedBy: this.currentProvider,
    };

    // Check if we already have this exact document embedded by the current provider
    const allDocs = await this.getAllDocs();
    const existingProviderDocs = allDocs.filter((doc) => doc.metadata?._embeddedBy === this.currentProvider);

    const existingDoc = existingProviderDocs.find(
      (doc) => doc.metadata?._contentHash === contentHash,
    );

    // Regardless of whether it existed or is new, mark the hash as seen.
    this.seenContentHashes.add(contentHash);

    if (
      existingDoc &&
      existingDoc.embedding &&
      existingDoc.embedding.length > 0
    ) {
      // It's a perfect match, no need to re-embed!
      return existingDoc;
    }

    try {
      // It's new, changed, or the provider switched. Re-embed!
      const embeddingProvider = getEmbeddingProvider();
      const embedding = await embeddingProvider.embed(content);

      const newDoc = await this.vectorStore.addDocumentWithEmbedding(
        content,
        embedding,
        enrichedMetadata,
        false, // Defer save for batch ingestion
      );
      if (newDoc && this.allDocsCache) {
        this.allDocsCache.push(newDoc);
      }
      return newDoc;
    } catch (error) {
      log.error(
        "Failed to embed document",
        error instanceof Error ? error.message : "Unknown error",
      );
      return null;
    }
  }

  /**
   * Syncs a batch of documents concurrently/incrementally.
   * Leverages batch embedding APIs and bulk database insertion.
   */
  async syncDocuments(
    batch: { content: string; metadata: Record<string, unknown>; rawSource?: string }[]
  ): Promise<Document[]> {
    if (batch.length === 0) return [];

    const allDocs = await this.getAllDocs();
    const existingProviderDocs = allDocs.filter(
      (doc) => doc.metadata?._embeddedBy === this.currentProvider
    );

    const docsToEmbed: { content: string; enrichedMetadata: Record<string, unknown>; index: number }[] = [];
    const results: Document[] = new Array(batch.length);

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      const inputForHashing = item.rawSource || item.content;
      const contentHash = this.generateHash(inputForHashing, item.metadata);

      const enrichedMetadata = {
        category: item.metadata.category || "static",
        ...item.metadata,
        _contentHash: contentHash,
        _embeddedBy: this.currentProvider,
      };

      this.seenContentHashes.add(contentHash);

      const existingDoc = existingProviderDocs.find(
        (doc) => doc.metadata?._contentHash === contentHash
      );

      if (existingDoc && existingDoc.embedding && existingDoc.embedding.length > 0) {
        results[i] = existingDoc;
      } else {
        docsToEmbed.push({
          content: item.content,
          enrichedMetadata,
          index: i,
        });
      }
    }

    if (docsToEmbed.length > 0) {
      try {
        const embeddingProvider = getEmbeddingProvider();
        let embeddings: number[][];

        if (embeddingProvider.embedBatch) {
          embeddings = await embeddingProvider.embedBatch(docsToEmbed.map((d) => d.content));
        } else {
          embeddings = await Promise.all(
            docsToEmbed.map((d) => embeddingProvider.embed(d.content))
          );
        }

        const insertPayload = docsToEmbed.map((d, i) => ({
          content: d.content,
          embedding: embeddings[i],
          metadata: d.enrichedMetadata,
        }));

        const newDocs = await this.vectorStore.addDocumentsWithEmbeddings(insertPayload);

        if (this.allDocsCache) {
          this.allDocsCache.push(...newDocs);
        }

        for (let i = 0; i < docsToEmbed.length; i++) {
          const originalIndex = docsToEmbed[i].index;
          results[originalIndex] = newDocs[i];
        }
      } catch (error) {
        log.error(
          "Failed to embed document batch",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }

    return results.filter(Boolean);
  }

  /**
   * Cleans up any old documents that are no longer actively accessed or updated.
   * This uses the natively updating `last_updated_at` column driven by the Postgres ON CONFLICT strategy.
   */
  async cleanupStaleDocuments(daysStale: number = 7): Promise<number> {
    const removedCount = await this.vectorStore.deleteStaleDocuments(daysStale);
    
    if (removedCount > 0) {
      log.info(`Cleaned up ${removedCount} stale/outdated embedded documents from Postgres.`);
    }

    return removedCount;
  }
}

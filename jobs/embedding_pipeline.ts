import crypto from "crypto";
import { VectorStore, Document } from "../memory/vector_store";
import { getEmbeddingProvider } from "../model/llm/embeddings";
import { log } from "../utils/logger";

export class EmbeddingPipeline {
  private vectorStore: VectorStore;
  private currentProvider: string;
  private seenContentHashes: Set<string>;

  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore;
    this.currentProvider = (process.env.LLM_PROVIDER || "ollama").toLowerCase();
    this.seenContentHashes = new Set<string>();
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

    // We attach the provider and hash to the metadata for tracking
    const enrichedMetadata = {
      ...metadata,
      _contentHash: contentHash,
      _embeddedBy: this.currentProvider,
    };

    // Check if we already have this exact document embedded by the current provider
    const allDocs = await this.vectorStore.getAllDocuments();
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
      );
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
   * Cleans up any old documents that are no longer actively accessed or updated.
   * This uses the natively updating `last_updated_at` column driven by the Postgres ON CONFLICT strategy.
   */
  async cleanupStaleDocuments(daysStale: number = 7): Promise<number> {
    const removedCount = await this.vectorStore.deleteStaleDocuments(daysStale, this.currentProvider);
    
    if (removedCount > 0) {
      log.info(`Cleaned up ${removedCount} stale/outdated embedded documents from Postgres.`);
    }

    return removedCount;
  }
}

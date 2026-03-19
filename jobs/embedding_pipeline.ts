import crypto from "crypto";
import { VectorStore, Document } from "../memory/vector_store";
import { getEmbeddingProvider } from "../model/llm/embeddings";
import { log } from "../utils/logger";

export class EmbeddingPipeline {
  private vectorStore: VectorStore;
  private currentProvider: string;
  private seenDocumentIds: Set<string>;

  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore;
    this.currentProvider = (process.env.LLM_PROVIDER || "ollama").toLowerCase();
    this.seenDocumentIds = new Set<string>();
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

    if (
      existingDoc &&
      existingDoc.embedding &&
      existingDoc.embedding.length > 0
    ) {
      // It's a perfect match, no need to re-embed!
      this.seenDocumentIds.add(existingDoc.id);
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
      this.seenDocumentIds.add(newDoc.id);
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
   * Cleans up any old documents that are no longer present in the physical files
   * Needs to be called at the very end of an ingestion run.
   */
  async cleanupStaleDocuments(): Promise<number> {
    const allDocs = await this.vectorStore.getAllDocuments();
    const staleDocIds: string[] = [];

    // Identify documents we didn't see in this run, OR documents embedded by an old provider
    for (const doc of allDocs) {
      const isSeen = this.seenDocumentIds.has(doc.id);
      const isCorrectProvider =
        doc.metadata?._embeddedBy === this.currentProvider;

      if (!isSeen || !isCorrectProvider) {
        staleDocIds.push(doc.id);
      }
    }

    if (staleDocIds.length > 0) {
      log.info(`Cleaning up ${staleDocIds.length} stale/outdated embedded documents from Postgres.`);
      await this.vectorStore.deleteDocuments(staleDocIds);
    }

    const removedCount = staleDocIds.length;

    return removedCount;
  }
}

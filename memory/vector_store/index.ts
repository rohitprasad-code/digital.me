import { Document, IVectorStore, VectorSearchFilter } from "./types";
import { PostgresVectorStore } from "./provider/postgres";
import { JsonVectorStore } from "./provider/json";
import { logger } from "../../utils/logger";

export * from "./types";

/**
 * Automatically routes vector processing sequentially through Neon Postgres or the graceful Local JSON file-store
 * depending entirely on whether the .env.local DATABASE_URL has been supplied.
 */
export class VectorStore implements IVectorStore {
  private store: IVectorStore;

  constructor(storageFile?: string) {
    if (process.env.DATABASE_URL) {
      this.store = new PostgresVectorStore();
    } else {
      this.store = new JsonVectorStore(storageFile);
    }
  }

  async getAllDocuments() {
    logger.log("DB /select");
    const docs = await this.store.getAllDocuments();
    logger.log("DB /output");
    return docs;
  }
  setDocuments(docs: Document[]) {
    if (this.store.setDocuments) this.store.setDocuments(docs);
  }
  async deleteDocuments(ids: string[]) {
    logger.log("DB /delete");
    const res = await this.store.deleteDocuments(ids);
    logger.log("DB /output");
    return res;
  }
  async deleteStaleDocuments(daysStale: number) {
    logger.log("DB /delete");
    const count = await this.store.deleteStaleDocuments(daysStale);
    logger.log("DB /output");
    return count;
  }
  async addDocumentsWithEmbeddings(
    documents: {
      content: string;
      embedding: number[];
      metadata: Record<string, unknown>;
    }[],
  ) {
    logger.log("DB /insert");
    let results;
    if (this.store.addDocumentsWithEmbeddings) {
      results = await this.store.addDocumentsWithEmbeddings(documents);
    } else {
      results = [];
      for (const doc of documents) {
        const res = await this.store.addDocumentWithEmbedding(
          doc.content,
          doc.embedding,
          doc.metadata,
        );
        results.push(res);
      }
    }
    logger.log("DB /output");
    return results;
  }

  async addDocumentWithEmbedding(
    c: string,
    e: number[],
    m?: Record<string, unknown>,
    autoSave?: boolean,
  ) {
    logger.log("DB /insert");
    const res = await this.store.addDocumentWithEmbedding(c, e, m, autoSave);
    logger.log("DB /output");
    return res;
  }
  async addDocument(
    c: string,
    m?: Record<string, unknown>,
    autoSave?: boolean,
  ) {
    logger.log("DB /insert");
    const res = await this.store.addDocument(c, m, autoSave);
    logger.log("DB /output");
    return res;
  }
  async search(q: string, l?: number, filter?: VectorSearchFilter) {
    logger.log("DB /select");
    const results = await this.store.search(q, l, filter);
    logger.log("DB /output");
    return results;
  }
  async save() {
    return this.store.save();
  }
  async load() {
    return this.store.load();
  }
  async clear() {
    logger.log("DB /delete");
    const res = await this.store.clear();
    logger.log("DB /output");
    return res;
  }
  async logHallucination(
    query: string,
    response: string,
    isSafe: boolean,
    feedback?: string,
  ) {
    logger.log("DB /insert");
    const res = await this.store.logHallucination(
      query,
      response,
      isSafe,
      feedback,
    );
    logger.log("DB /output");
    return res;
  }
  async getHallucinations() {
    logger.log("DB /select");
    const logs = await this.store.getHallucinations();
    logger.log("DB /output");
    return logs;
  }
  async markHallucinationCorrected(id: string) {
    logger.log("DB /update");
    const res = await this.store.markHallucinationCorrected(id);
    logger.log("DB /output");
    return res;
  }
  async getDocumentsByTimeRange(
    startDate: Date,
    endDate: Date,
    sourcePrefix?: string,
  ) {
    logger.log("DB /select");
    const docs = await this.store.getDocumentsByTimeRange(
      startDate,
      endDate,
      sourcePrefix,
    );
    logger.log("DB /output");
    return docs;
  }
  async close() {
    if (this.store.close) {
      await this.store.close();
    }
  }
}

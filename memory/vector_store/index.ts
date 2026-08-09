import { Document, IVectorStore, VectorSearchFilter } from "./types";
import { PostgresVectorStore } from "./provider/postgres";
import { JsonVectorStore } from "./provider/json";

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
    return this.store.getAllDocuments();
  }
  setDocuments(docs: Document[]) {
    if (this.store.setDocuments) this.store.setDocuments(docs);
  }
  async deleteDocuments(ids: string[]) {
    return this.store.deleteDocuments(ids);
  }
  async deleteStaleDocuments(daysStale: number) {
    return this.store.deleteStaleDocuments(daysStale);
  }
  async addDocumentsWithEmbeddings(
    documents: { content: string; embedding: number[]; metadata: Record<string, unknown> }[]
  ) {
    if (this.store.addDocumentsWithEmbeddings) {
      return this.store.addDocumentsWithEmbeddings(documents);
    }
    const results = [];
    for (const doc of documents) {
      const res = await this.store.addDocumentWithEmbedding(doc.content, doc.embedding, doc.metadata);
      results.push(res);
    }
    return results;
  }

  async addDocumentWithEmbedding(
    c: string,
    e: number[],
    m?: Record<string, unknown>,
    autoSave?: boolean,
  ) {
    return this.store.addDocumentWithEmbedding(c, e, m, autoSave);
  }
  async addDocument(c: string, m?: Record<string, unknown>, autoSave?: boolean) {
    return this.store.addDocument(c, m, autoSave);
  }
  async search(q: string, l?: number, filter?: VectorSearchFilter) {
    return this.store.search(q, l, filter);
  }
  async save() {
    return this.store.save();
  }
  async load() {
    return this.store.load();
  }
  async clear() {
    return this.store.clear();
  }
  async logHallucination(query: string, response: string, isSafe: boolean, feedback?: string) {
    return this.store.logHallucination(query, response, isSafe, feedback);
  }
  async getHallucinations() {
    return this.store.getHallucinations();
  }
  async markHallucinationCorrected(id: string) {
    return this.store.markHallucinationCorrected(id);
  }
  async getDocumentsByTimeRange(startDate: Date, endDate: Date) {
    return this.store.getDocumentsByTimeRange(startDate, endDate);
  }
  async close() {
    if (this.store.close) {
      await this.store.close();
    }
  }
}

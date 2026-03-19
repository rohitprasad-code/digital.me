import { Document, IVectorStore } from "./types";
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
  async addDocumentWithEmbedding(
    c: string,
    e: number[],
    m?: Record<string, unknown>,
  ) {
    return this.store.addDocumentWithEmbedding(c, e, m);
  }
  async addDocument(c: string, m?: Record<string, unknown>) {
    return this.store.addDocument(c, m);
  }
  async search(q: string, l?: number) {
    return this.store.search(q, l);
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
}

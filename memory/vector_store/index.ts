import { Document } from "./types";
import { PostgresVectorStore } from "./postgres";
import { LocalVectorStore } from "./local";

export * from "./types";

export interface IVectorStore {
  getAllDocuments(): Promise<Document[]> | Document[];
  deleteDocuments(ids: string[]): Promise<void>;
  deleteStaleDocuments(daysStale: number): Promise<number>;
  setDocuments?(docs: Document[]): void;
  addDocumentWithEmbedding(content: string, embedding: number[], metadata?: Record<string, unknown>): Promise<Document>;
  addDocument(content: string, metadata?: Record<string, unknown>): Promise<Document>;
  search(query: string, limit?: number): Promise<{ doc: Document; score: number }[]>;
  save(): Promise<void>;
  load(): Promise<void>;
  clear(): Promise<void>;
}

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
      this.store = new LocalVectorStore(storageFile);
    }
  }

  async getAllDocuments() { return this.store.getAllDocuments(); }
  setDocuments(docs: Document[]) { if (this.store.setDocuments) this.store.setDocuments(docs); }
  async deleteDocuments(ids: string[]) { return this.store.deleteDocuments(ids); }
  async deleteStaleDocuments(daysStale: number) { return this.store.deleteStaleDocuments(daysStale); }
  async addDocumentWithEmbedding(c: string, e: number[], m?: Record<string, unknown>) { return this.store.addDocumentWithEmbedding(c, e, m); }
  async addDocument(c: string, m?: Record<string, unknown>) { return this.store.addDocument(c, m); }
  async search(q: string, l?: number) { return this.store.search(q, l); }
  async save() { return this.store.save(); }
  async load() { return this.store.load(); }
  async clear() { return this.store.clear(); }
}

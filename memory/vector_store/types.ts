export interface Document {
  id: string;
  filePath?: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  lastUpdatedAt?: string | Date;
}

export interface IVectorStore {
  getAllDocuments(): Promise<Document[]> | Document[];
  deleteDocuments(ids: string[]): Promise<void>;
  deleteStaleDocuments(daysStale: number): Promise<number>;
  setDocuments?(docs: Document[]): void;
  addDocumentWithEmbedding(
    content: string,
    embedding: number[],
    metadata?: Record<string, unknown>,
  ): Promise<Document>;
  addDocument(
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<Document>;
  search(
    query: string,
    limit?: number,
  ): Promise<{ doc: Document; score: number }[]>;
  save(): Promise<void>;
  load(): Promise<void>;
  clear(): Promise<void>;
}

export type MemoryCategory = "static" | "dynamic" | "conversational" | "system";

export interface VectorSearchFilter {
  category?: MemoryCategory | MemoryCategory[];
  excludeCategory?: MemoryCategory[];
  source?: string;
  [key: string]: unknown;
}

export interface Document {
  id: string;
  filePath?: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  lastUpdatedAt?: string | Date;
  occurredAt?: string | Date;
}

export interface HallucinationLog {
  id: string;
  query: string;
  response: string;
  isSafe: boolean;
  feedback: string | null;
  createdAt: string;
  corrected?: boolean;
}

export interface IVectorStore {
  getAllDocuments(): Promise<Document[]> | Document[];
  deleteDocuments(ids: string[]): Promise<void>;
  deleteStaleDocuments(daysStale: number): Promise<number>;
  setDocuments?(docs: Document[]): void;
  addDocumentsWithEmbeddings?(
    documents: { content: string; embedding: number[]; metadata: Record<string, unknown> }[]
  ): Promise<Document[]>;
  addDocumentWithEmbedding(
    content: string,
    embedding: number[],
    metadata?: Record<string, unknown>,
    autoSave?: boolean,
  ): Promise<Document>;
  addDocument(
    content: string,
    metadata?: Record<string, unknown>,
    autoSave?: boolean,
  ): Promise<Document>;
  search(
    query: string,
    limit?: number,
    filter?: VectorSearchFilter,
  ): Promise<{ doc: Document; score: number }[]>;
  save(): Promise<void>;
  load(): Promise<void>;
  clear(): Promise<void>;
  logHallucination(
    query: string,
    response: string,
    isSafe: boolean,
    feedback?: string,
  ): Promise<void>;
  getHallucinations(): Promise<HallucinationLog[]>;
  markHallucinationCorrected(id: string): Promise<void>;
  getDocumentsByTimeRange(
    startDate: Date,
    endDate: Date,
  ): Promise<Document[]>;
}

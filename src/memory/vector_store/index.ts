import ollama from 'ollama';
import computeCosineSimilarity from 'compute-cosine-similarity';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

export interface Document {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
}

export class VectorStore {
  private documents: Document[] = [];
  private readonly storageFile: string;

  constructor(storageFile: string = 'embedded_vectors.json') {
    this.storageFile = path.resolve(process.cwd(), 'src/data', storageFile);
  }

  async addDocument(content: string, metadata: Record<string, any> = {}): Promise<Document> {
    const embeddingResponse = await ollama.embeddings({
      model: 'nomic-embed-text', 
      prompt: content,
    });

    const doc: Document = {
      id: uuidv4(),
      content,
      metadata,
      embedding: embeddingResponse.embedding,
    };

    this.documents.push(doc);
    await this.save();
    return doc;
  }

  async search(query: string, limit: number = 3): Promise<{ doc: Document; score: number }[]> {
    const queryEmbeddingResponse = await ollama.embeddings({
      model: 'nomic-embed-text',
      prompt: query,
    });
    const queryEmbedding = queryEmbeddingResponse.embedding;

    const scoredDocs = this.documents.map((doc) => {
      if (!doc.embedding) return { doc, score: -1 };
      const score = computeCosineSimilarity(queryEmbedding, doc.embedding) || -1;
      return { doc, score };
    });

    scoredDocs.sort((a, b) => b.score - a.score);

    return scoredDocs.slice(0, limit);
  }

  async save(): Promise<void> {
    try {
        await fs.mkdir(path.dirname(this.storageFile), { recursive: true });
        await fs.writeFile(this.storageFile, JSON.stringify(this.documents, null, 2));
    } catch (error) {
        console.error('Failed to save vector store:', error);
    }
  }

  async load(): Promise<void> {
    try {
      console.log('Loading vector store from:', this.storageFile);
      const data = await fs.readFile(this.storageFile, 'utf-8');
      this.documents = JSON.parse(data);
      console.log(`Loaded ${this.documents.length} documents.`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log('Vector store file not found, starting empty.');
        this.documents = [];
      } else {
        console.error('Failed to load vector store:', error);
        throw error;
      }
    }
  }
  
  async clear(): Promise<void> {
      this.documents = [];
      await this.save();
  }
}

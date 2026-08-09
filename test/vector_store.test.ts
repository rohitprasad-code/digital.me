import { describe, it, expect, vi, beforeEach } from "vitest";
import { VectorStore, IVectorStore } from "../memory/vector_store";
import { JsonVectorStore } from "../memory/vector_store/provider/json";
import { PostgresVectorStore } from "../memory/vector_store/provider/postgres";
import * as embeddings from "../model/providers/embeddings";

const mockSql = vi.fn().mockImplementation(() => Promise.resolve([]));
vi.mock("postgres", () => {
  return {
    default: vi.fn().mockImplementation(() => mockSql),
  };
});

const mockEmbedder = {
  embed: vi.fn().mockImplementation(async () => [1, 0, 0]),
};

describe("JsonVectorStore Category Filtering", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(embeddings, "getEmbeddingProvider").mockReturnValue(mockEmbedder);
  });

  it("should filter search results by category", async () => {
    const store = new JsonVectorStore("test_store.json");
    store.setDocuments([
      {
        id: "1",
        content: "Software developer resume",
        metadata: { category: "static" },
        embedding: [1, 0, 0],
      },
      {
        id: "2",
        content: "Ran 5k in 22 minutes",
        metadata: { category: "dynamic" },
        embedding: [1, 0, 0],
      },
      {
        id: "3",
        content: "System sync marker",
        metadata: { category: "system" },
        embedding: [1, 0, 0],
      },
    ]);

    // Query with filter for static
    const staticResults = await store.search("developer", 10, { category: "static" });
    expect(staticResults.length).toBe(1);
    expect(staticResults[0].doc.content).toBe("Software developer resume");

    // Query with filter for dynamic
    const dynamicResults = await store.search("running", 10, { category: "dynamic" });
    expect(dynamicResults.length).toBe(1);
    expect(dynamicResults[0].doc.content).toBe("Ran 5k in 22 minutes");

    // Default query without filter should exclude system markers
    const defaultResults = await store.search("anything", 10);
    expect(defaultResults.length).toBe(2);
    expect(defaultResults.some((r) => r.doc.metadata.category === "system")).toBe(false);
  });
});

describe("VectorStore Wrapper Delegation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should delegate markHallucinationCorrected to the underlying store", async () => {
    const store = new VectorStore("test_store.json");
    const spy = vi.spyOn((store as unknown as { store: IVectorStore }).store, "markHallucinationCorrected").mockResolvedValue(undefined);
    
    await store.markHallucinationCorrected("test-id-123");
    
    expect(spy).toHaveBeenCalledWith("test-id-123");
  });
});

describe("PostgresVectorStore addDocumentsWithEmbeddings", () => {
  beforeEach(() => {
    mockSql.mockClear();
  });

  it("should parse filePath/source metadata and generate content hashes correctly", async () => {
    const store = new PostgresVectorStore();
    const documents = [
      {
        content: "Hello from github",
        embedding: [0.1, 0.2],
        metadata: { source: "github", type: "issues" },
      },
      {
        content: "Hello from local file",
        embedding: [0.3, 0.4],
        metadata: { filePath: "src/index.ts" },
      },
    ];

    const result = await store.addDocumentsWithEmbeddings(documents);

    expect(result.length).toBe(2);
    expect(result[0].filePath).toBe("api://github/issues");
    expect(result[0].metadata._contentHash).toBeDefined();
    
    expect(result[1].filePath).toBe("src/index.ts");
    expect(result[1].metadata._contentHash).toBeDefined();

    expect(mockSql).toHaveBeenCalled();
  });
});

describe("JsonVectorStore concurrent atomic writes", () => {
  it("should handle multiple concurrent saves without throwing and should complete atomically", async () => {
    const store = new JsonVectorStore("test_concurrent_store.json");
    store.setDocuments([
      { id: "1", content: "Doc 1", metadata: {}, embedding: [1, 0, 0] }
    ]);

    // Perform concurrent saves
    const savePromises = Array.from({ length: 10 }).map((_, i) => {
      // Mutate documents to simulate rapid changes
      store.setDocuments([
        { id: "1", content: `Doc 1 version ${i}`, metadata: {}, embedding: [1, 0, 0] }
      ]);
      return store.save();
    });

    await expect(Promise.all(savePromises)).resolves.not.toThrow();

    // Verify loading back gets the last written state or works cleanly
    const verifyStore = new JsonVectorStore("test_concurrent_store.json");
    await verifyStore.load();
    const docs = await verifyStore.getAllDocuments();
    expect(docs.length).toBe(1);
    expect(docs[0].content).toMatch(/Doc 1 version/);
  });
});

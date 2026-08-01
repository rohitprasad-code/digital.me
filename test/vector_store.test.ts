import { describe, it, expect, vi, beforeEach } from "vitest";
import { JsonVectorStore } from "../memory/vector_store/provider/json";
import * as embeddings from "../model/providers/embeddings";

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

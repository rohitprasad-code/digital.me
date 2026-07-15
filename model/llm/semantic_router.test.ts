/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SemanticRouter } from "./semantic_router";
import * as embeddings from "./embeddings";
import * as provider from "./provider";

// Simple helper to create mock vectors
const mockVectors: Record<string, number[]> = {
  "hello": [1, 0, 0],
  "hi": [1, 0, 0],
  "explain quantum computing": [0, 1, 0],
  "write a compiler in Rust": [0, 1, 0],
  "greet": [1, 0, 0],
  "coding": [0, 1, 0],
};

const mockEmbedder = {
  embed: vi.fn().mockImplementation(async (text: string) => {
    return mockVectors[text] || [0, 0, 1];
  }),
};

const mockLLM = {
  chat: vi.fn(),
  chatStream: vi.fn(),
  healthCheck: vi.fn(),
};

describe("SemanticRouter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(embeddings, "getEmbeddingProvider").mockReturnValue(mockEmbedder);
    vi.spyOn(provider, "getLLMProvider").mockReturnValue(mockLLM);
  });

  it("should route simple queries to local/cheaper model and complex to default model", async () => {
    const router = new SemanticRouter("gemini"); // default is gemini

    // Add route for simple queries
    await router.addRoute("simple", "groq", ["hello", "hi"]);

    // Test a matching simple query
    const provider1 = await router.route("greet", 0.7);
    expect(provider.getLLMProvider).toHaveBeenCalledWith("groq");

    // Test a complex query (no match)
    const provider2 = await router.route("explain quantum computing", 0.7);
    expect(provider.getLLMProvider).toHaveBeenCalledWith("gemini");
  });
});

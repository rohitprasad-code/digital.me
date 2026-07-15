import { describe, it, expect, beforeEach } from "vitest";
import { registry } from "./registry";
import { LLMProvider, ChatMessage, ChatOptions, ChatResponse } from "./llm/provider";
import { EmbeddingProvider } from "./llm/embeddings";
import { ToolDefinition } from "./tools/types";

// Mock providers for testing
class MockLLMProvider implements LLMProvider {
  async chat(_messages: ChatMessage[], _options?: ChatOptions): Promise<ChatResponse> {
    return { content: "mock response" };
  }
  async *chatStream(_messages: ChatMessage[], _options?: ChatOptions): AsyncIterable<string> {
    yield "mock stream";
  }
  async healthCheck(): Promise<void> {}
}

class MockEmbeddingProvider implements EmbeddingProvider {
  async embed(_text: string): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }
}

describe("UnifiedRegistry", () => {
  beforeEach(() => {
    registry.clear();
  });

  it("should register and retrieve LLM providers", () => {
    const mockProvider = new MockLLMProvider();
    registry.registerLLMProvider("mock-llm", mockProvider);

    expect(registry.listLLMProviders()).toContain("mock-llm");
    expect(registry.getLLMProvider("mock-llm")).toBe(mockProvider);
    expect(registry.getLLMProvider("MOCK-LLM")).toBe(mockProvider); // Case insensitivity
  });

  it("should throw error for unregistered LLM provider", () => {
    expect(() => registry.getLLMProvider("non-existent")).toThrowError(
      'LLM provider "non-existent" is not registered in the Unified Registry.'
    );
  });

  it("should register and retrieve Embedding providers", () => {
    const mockProvider = new MockEmbeddingProvider();
    registry.registerEmbeddingProvider("mock-embedding", mockProvider);

    expect(registry.listEmbeddingProviders()).toContain("mock-embedding");
    expect(registry.getEmbeddingProvider("mock-embedding")).toBe(mockProvider);
  });

  it("should register and retrieve Tools", () => {
    const mockTool: ToolDefinition = {
      name: "mock_tool",
      description: "A mock tool",
      parameters: {
        type: "object",
        properties: {},
      },
      execute: async () => "result",
    };

    registry.registerTool("mock_tool", mockTool);

    expect(registry.getTool("mock_tool")).toBe(mockTool);
    expect(registry.listTools()).toContain(mockTool);
  });
});

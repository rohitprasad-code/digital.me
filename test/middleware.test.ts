/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MiddlewareLLMProvider, NextFn } from "../model/middleware/middleware";
import { createCacheMiddleware } from "../model/middleware/cache";
import { createRateLimiterMiddleware, totalCost, totalTokensUsed } from "../model/middleware/rate_limiter";
import { createObservabilityMiddleware, activeTraces } from "../model/middleware/observability";
import { LLMProvider, ChatMessage, ChatOptions, ChatResponse } from "../model/providers/provider";

class MockBaseProvider implements LLMProvider {
  chatCalls = 0;
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    this.chatCalls++;
    return { content: `response to: ${messages[messages.length - 1]?.content}` };
  }
  async *chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<string> {
    yield "stream chunk";
  }
  async healthCheck(): Promise<void> {}
}

describe("Middleware Chain & Implementations", () => {
  let mockBase: MockBaseProvider;

  beforeEach(() => {
    mockBase = new MockBaseProvider();
    activeTraces.length = 0;
  });

  it("should chain multiple middlewares in sequence", async () => {
    const order: number[] = [];

    const mw1 = async (messages: ChatMessage[], options: ChatOptions | undefined, next: NextFn) => {
      order.push(1);
      const res = await next(messages, options);
      order.push(4);
      return res;
    };

    const mw2 = async (messages: ChatMessage[], options: ChatOptions | undefined, next: NextFn) => {
      order.push(2);
      const res = await next(messages, options);
      order.push(3);
      return res;
    };

    const provider = new MiddlewareLLMProvider(mockBase, [mw1, mw2]);
    const res = await provider.chat([{ role: "user", content: "hello" }]);

    expect(order).toEqual([1, 2, 3, 4]);
    expect(res.content).toBe("response to: hello");
    expect(mockBase.chatCalls).toBe(1);
  });

  it("should cache responses in the caching middleware", async () => {
    const cacheMw = createCacheMiddleware();
    const provider = new MiddlewareLLMProvider(mockBase, [cacheMw]);

    const messages = [{ role: "user" as const, content: "test query" }];

    const res1 = await provider.chat(messages);
    const res2 = await provider.chat(messages);

    expect(res1.content).toBe(res2.content);
    expect(mockBase.chatCalls).toBe(1); // Second call should be a cache hit
  });

  it("should track observability traces", async () => {
    const obsMw = createObservabilityMiddleware();
    const provider = new MiddlewareLLMProvider(mockBase, [obsMw]);

    await provider.chat([{ role: "user", content: "observability test" }]);

    expect(activeTraces.length).toBe(1);
    expect(activeTraces[0].messages[0].content).toBe("observability test");
    expect(activeTraces[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(activeTraces[0].response.content).toBe("response to: observability test");
  });

  it("should enforce rate limits and track cost", async () => {
    const limiter = createRateLimiterMiddleware({
      maxRequestsPerMinute: 1, // Only 1 request allowed per minute
    });
    const provider = new MiddlewareLLMProvider(mockBase, [limiter]);

    await provider.chat([{ role: "user", content: "first request" }]);

    // Second request within a minute should fail
    await expect(
      provider.chat([{ role: "user", content: "second request" }])
    ).rejects.toThrowError(/Requests Per Minute/);
  });

  it("should enforce TPM (Tokens Per Minute) limits", async () => {
    const limiter = createRateLimiterMiddleware({
      maxTokensPerMinute: 10, // Very small token limit
    });
    const provider = new MiddlewareLLMProvider(mockBase, [limiter]);

    // Send a long message to exceed the 10 token limit
    // estimateTokens rounds up characters / 4
    await expect(
      provider.chat([{ role: "user", content: "This is a very long prompt that will exceed the token limit." }])
    ).rejects.toThrowError(/Tokens Per Minute/);
  });

  it("should track totalCost and totalTokensUsed correctly", async () => {
    const limiter = createRateLimiterMiddleware({
      inputTokenCostPer1K: 2.0,
      outputTokenCostPer1K: 4.0,
    });
    const provider = new MiddlewareLLMProvider(mockBase, [limiter]);

    const initialCost = totalCost;
    const initialTokens = totalTokensUsed;

    // Send request: "hello" -> estimateTokens("hello") = Math.ceil(5 / 4) = 2 input tokens
    // mockBase response: "response to: hello" -> estimateTokens("response to: hello") = Math.ceil(19 / 4) = 5 output tokens
    // Expected total tokens = 2 + 5 = 7
    // Expected cost = (2 * 2.0 + 5 * 4.0) / 1000 = (4.0 + 20.0) / 1000 = 0.024
    await provider.chat([{ role: "user", content: "hello" }]);

    expect(totalTokensUsed).toBe(initialTokens + 7);
    expect(totalCost).toBeCloseTo(initialCost + 0.024, 5);
  });
});

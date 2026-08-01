import { describe, it, expect, vi } from "vitest";
import { verifyGrounding } from "../model/middleware/grounding";

const mockChat = vi.fn();

vi.mock("../model/providers/provider", () => {
  return {
    getLLMProvider: () => ({
      chat: mockChat,
      chatStream: async function* () {},
      healthCheck: async () => {},
    }),
  };
});

describe("Factual Grounding Guardrails", () => {
  it("should return safe = true if context is empty", async () => {
    const res = await verifyGrounding("", "I have 10 years of experience.");
    expect(res.safe).toBe(true);
  });

  it("should return safe = true when LLM responds with SAFE", async () => {
    mockChat.mockResolvedValueOnce({ content: "SAFE" });
    const res = await verifyGrounding(
      "I have 3 years of experience as a developer.",
      "I have 3 years of experience."
    );
    expect(res.safe).toBe(true);
    expect(mockChat).toHaveBeenCalled();
  });

  it("should return safe = false and feedback when LLM responds with UNSAFE", async () => {
    mockChat.mockResolvedValueOnce({
      content: "UNSAFE: The response claims 10 years of experience but the context only states 3 years."
    });
    const res = await verifyGrounding(
      "I have 3 years of experience as a developer.",
      "I have 10 years of experience."
    );
    expect(res.safe).toBe(false);
    expect(res.feedback).toContain("The response claims 10 years of experience");
  });
});

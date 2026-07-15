/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach } from "vitest";
import { runAgentLoop } from "../model/agents/json_agent";
import { registry } from "../model/registry/unified";
import { LLMProvider, ChatMessage, ChatOptions, ChatResponse } from "../model/providers/provider";

class MockAgentLLM implements LLMProvider {
  private callCount = 0;

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    this.callCount++;
    if (this.callCount === 1) {
      // First round: ask to run a tool
      return {
        content: `Let's use a tool:
\`\`\`json
{
  "tool": "calculator",
  "arguments": { "expression": "2 + 2" }
}
\`\`\``,
      };
    } else {
      // Second round: return final answer after receiving tool result
      const lastMessage = messages[messages.length - 1];
      return {
        content: `The calculation result is 4.`,
      };
    }
  }

  async *chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<string> {
    yield "stream chunk";
  }

  async healthCheck(): Promise<void> {}
}

describe("Unified Tool Calling Agent Loop", () => {
  beforeEach(() => {
    registry.clear();
  });

  it("should run the agent loop, call a registered tool, and return the final summary", async () => {
    const mockToolExecuted = { executed: false, args: {} };

    registry.registerTool("calculator", {
      name: "calculator",
      description: "Perform math calculation",
      parameters: {
        type: "object",
        properties: {
          expression: { type: "string" },
        },
      },
      execute: async (args) => {
        mockToolExecuted.executed = true;
        mockToolExecuted.args = args;
        return 4;
      },
    });

    const mockLLM = new MockAgentLLM();
    const finalResult = await runAgentLoop(
      mockLLM,
      "You are a math helper.",
      [{ role: "user", content: "compute 2 + 2" }]
    );

    expect(mockToolExecuted.executed).toBe(true);
    expect(mockToolExecuted.args).toEqual({ expression: "2 + 2" });
    expect(finalResult).toBe("The calculation result is 4.");
  });
});

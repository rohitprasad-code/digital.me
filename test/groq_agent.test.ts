import { describe, it, expect, beforeEach, vi } from "vitest";
import { runAgentLoop } from "../model/agents/groq_agent";

// Mock registry tools module to avoid initializing real MCP clients and clearing maps.
// Path must resolve to `/Users/rohitprasad/Backup/digital-me/model/registry/tools`
vi.mock("../model/registry/tools", () => {
  const TOOL_MAP: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {};
  return {
    TOOL_MAP,
    toolSchemas: [],
    initializeMcpTools: vi.fn(),
    isInitialized: true,
  };
});

const mockCreate = vi.fn();
const mockListModels = vi.fn().mockResolvedValue({ data: [{ id: "llama-3-8b" }] });

// Mock groq-sdk
vi.mock("groq-sdk", () => {
  return {
    default: class MockGroq {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
      models = {
        list: mockListModels,
      };
    },
  };
});

describe("Groq Agent Concurrent Loop & Edge Cases", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCreate.mockReset();
    mockListModels.mockReset();
    mockListModels.mockResolvedValue({ data: [{ id: "llama-3-8b" }] });
    process.env.GROQ_API_KEY = "mock-key";
    vi.spyOn(global, "fetch").mockImplementation(() => Promise.resolve(new Response()));
  });

  it("should execute multiple tool calls concurrently and handle mixed success and failure", async () => {
    const executedTools: string[] = [];
    const { TOOL_MAP } = await import("../model/registry/tools");

    // Register test tools in TOOL_MAP
    TOOL_MAP["test_tool_success"] = async (args: Record<string, unknown>) => {
      executedTools.push("success");
      const x = typeof args.x === "number" ? args.x : 0;
      return { val: x * 2 };
    };

    TOOL_MAP["test_tool_fail"] = async () => {
      executedTools.push("fail");
      throw new Error("Something went wrong");
    };

    // Round 0: Returns 4 tool calls (one succeeds, one fails, one is unknown/not found, one has invalid args)
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "Let me call some tools.",
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: {
                  name: "test_tool_success",
                  arguments: '{"x": 5}',
                },
              },
              {
                id: "call_2",
                type: "function",
                function: {
                  name: "test_tool_fail",
                  arguments: '{}',
                },
              },
              {
                id: "call_3",
                type: "function",
                function: {
                  name: "non_existent_tool",
                  arguments: '{}',
                },
              },
              {
                id: "call_4",
                type: "function",
                function: {
                  name: "test_tool_success",
                  arguments: '{invalid_json}',
                },
              }
            ],
          },
        },
      ],
    });

    // Round 1: Final answer
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "Finished executing tools. Here is the response.",
            tool_calls: [],
          },
        },
      ],
    });

    const toolOutputs: string[] = [];
    const finalResponse = await runAgentLoop(
      "You are a helpful assistant.",
      [{ role: "user", content: "run tools" }],
      toolOutputs
    );

    expect(finalResponse).toBe("Finished executing tools. Here is the response.");
    
    // Verify that success and fail tools were both run
    expect(executedTools).toContain("success");
    expect(executedTools).toContain("fail");

    // Let's verify what was logged to toolOutputs
    // Tool 1: Success
    expect(toolOutputs.some(o => o.includes("test_tool_success") && o.includes('{"val":10}'))).toBe(true);
    // Tool 2: Fail (caught and stringified)
    expect(toolOutputs.some(o => o.includes("test_tool_fail") && o.includes("Something went wrong"))).toBe(true);
    // Tool 3: Unknown tool (not in TOOL_MAP)
    expect(toolOutputs.some(o => o.includes("non_existent_tool") && o.includes("Unknown tool"))).toBe(true);
    // Tool 4: Invalid JSON argument formatting (defaults to empty object and executes or fails gracefully)
    expect(toolOutputs.some(o => o.includes("test_tool_success") && o.includes('{}'))).toBe(true);
  });

  it("should enforce the concurrency limit (max 5 active executions at once)", async () => {
    const { TOOL_MAP } = await import("../model/registry/tools");
    let activeCount = 0;
    let maxActiveCount = 0;

    TOOL_MAP["test_concurrency_tool"] = async () => {
      activeCount++;
      if (activeCount > maxActiveCount) {
        maxActiveCount = activeCount;
      }
      // Wait a tiny bit to keep concurrent tasks active at the same time
      await new Promise(resolve => setTimeout(resolve, 50));
      activeCount--;
      return { ok: true };
    };

    // Return 8 tool calls at once
    const toolCalls = Array.from({ length: 8 }).map((_, index) => ({
      id: `call_${index}`,
      type: "function",
      function: {
        name: "test_concurrency_tool",
        arguments: "{}",
      },
    }));

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "Running many tools.",
            tool_calls: toolCalls,
          },
        },
      ],
    });

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "Finished executing.",
            tool_calls: [],
          },
        },
      ],
    });

    const toolOutputs: string[] = [];
    await runAgentLoop(
      "You are a helpful assistant.",
      [{ role: "user", content: "run tools" }],
      toolOutputs
    );

    // Should have executed up to the concurrency limit (5), not all 8 at once
    expect(maxActiveCount).toBe(5);
  });

  it("should timeout tool calls that exceed the threshold", async () => {
    const { TOOL_MAP } = await import("../model/registry/tools");
    
    vi.useFakeTimers();

    TOOL_MAP["test_slow_tool"] = async () => {
      return new Promise((resolve) => {
        setTimeout(() => resolve({ val: "completed" }), 20000); // 20s execution
      });
    };

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "Calling slow tool.",
            tool_calls: [
              {
                id: "call_slow",
                type: "function",
                function: {
                  name: "test_slow_tool",
                  arguments: "{}",
                },
              },
            ],
          },
        },
      ],
    });

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "Finished execution.",
            tool_calls: [],
          },
        },
      ],
    });

    const toolOutputs: string[] = [];
    const runPromise = runAgentLoop(
      "You are a helpful assistant.",
      [{ role: "user", content: "run slow tool" }],
      toolOutputs
    );

    // Fast-forward timers to trigger the timeout threshold of 10000ms
    await vi.advanceTimersByTimeAsync(11000);

    const finalResponse = await runPromise;
    expect(finalResponse).toBe("Finished execution.");
    expect(toolOutputs.some(o => o.includes("test_slow_tool") && o.includes("timed out"))).toBe(true);

    vi.useRealTimers();
  });
});

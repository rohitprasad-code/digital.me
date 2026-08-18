/**
 * Agent Orchestration Loop
 *
 * Manages the back-and-forth between the LLM and tool execution.
 * When the LLM decides to call a tool, the loop:
 *   1. Executes the function via TOOL_MAP
 *   2. Feeds the result back to the LLM
 *   3. Repeats until the LLM produces a final text response
 */

import {
  TOOL_MAP,
  toolSchemas,
  initializeMcpTools,
  isInitialized,
} from "../registry/tools";
import Groq from "groq-sdk";
import { logger } from "../../utils/logger";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "groq-sdk/resources/chat/completions";
import { getBestGroqModel } from "../providers/groq/model_selector";

const MAX_TOOL_ROUNDS = 5; // safety limit to prevent infinite loops
const DEFAULT_TOOL_TIMEOUT_MS = 10000; // 10 seconds timeout per tool execution
const CONCURRENCY_LIMIT = 5; // run up to 5 tools concurrently

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

async function runWithLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  const executing = new Set<Promise<void>>();

  for (let i = 0; i < tasks.length; i++) {
    const p = (async () => {
      results[i] = await tasks[i]();
    })();
    executing.add(p);
    p.then(() => executing.delete(p));
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
  return results;
}

function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Get one from https://console.groq.com/keys",
    );
  }
  return new Groq({ apiKey });
}

/**
 * Runs the agent loop with tool calling support.
 *
 * @param systemPrompt - The system prompt (includes RAG context)
 * @param userMessages - The conversation history
 * @returns The final text response from the LLM
 */
export async function runAgentLoop(
  systemPrompt: string,
  userMessages: { role: "user" | "assistant"; content: string }[],
  toolOutputs?: string[],
): Promise<string> {
  if (!isInitialized) {
    await initializeMcpTools();
  }
  const groq = getGroqClient();
  const model = await getBestGroqModel(groq);

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...userMessages,
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await groq.chat.completions.create({
      model,
      messages,
      tools: toolSchemas as unknown as ChatCompletionTool[],
      tool_choice: "auto",
      ...({ reasoning_effort: "none" } as Record<string, unknown>),
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    // If no tool calls → we have our final answer
    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      let content = assistantMessage.content || "";
      content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      return content;
    }

    // Append the assistant's message (with tool calls) to the conversation
    messages.push(assistantMessage);

    // Execute tool calls concurrently with batching/limit and timeout protection
    const toolTasks = assistantMessage.tool_calls.map((toolCall) => {
      return async () => {
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown> = {};
        try {
          fnArgs = JSON.parse(toolCall.function.arguments || "{}");
        } catch (e) {
          logger.error(`Failed to parse tool arguments for ${fnName}`, e instanceof Error ? e.message : String(e));
        }

        logger.log(`MCP /input: ${fnName}`);

        let result: unknown;
        try {
          const executor = TOOL_MAP[fnName];
          if (!executor) {
            result = { error: `Unknown tool: ${fnName}` };
          } else {
            // Apply timeout to the tool execution
            result = await withTimeout(executor(fnArgs), DEFAULT_TOOL_TIMEOUT_MS);
          }
        } catch (error) {
          result = {
            error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }

        const resultStr = JSON.stringify(result);
        logger.log(
          `MCP /output: ${resultStr.substring(0, 100).replace(/\n/g, " ")}${resultStr.length > 100 ? "..." : ""}`,
        );

        if (toolOutputs) {
          toolOutputs.push(
            `Tool "${fnName}" called with arguments ${JSON.stringify(fnArgs)} returned: ${JSON.stringify(result)}`,
          );
        }

        return {
          role: "tool" as const,
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        };
      };
    });

    const results = await runWithLimit(toolTasks, CONCURRENCY_LIMIT);
    messages.push(...results);
  }

  // Safety: if we hit the max rounds, ask the LLM to summarize
  const fallback = await groq.chat.completions.create({
    model,
    messages: [
      ...messages,
      {
        role: "user",
        content:
          "Please summarize the tool results and give me the final answer.",
      },
    ],
    ...({ reasoning_effort: "none" } as Record<string, unknown>),
  });

  let fallbackContent =
    fallback.choices[0]?.message?.content ||
    "I could not complete the request.";
  fallbackContent = fallbackContent
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .trim();
  return fallbackContent;
}

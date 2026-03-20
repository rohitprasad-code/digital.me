/**
 * Agent Orchestration Loop
 *
 * Manages the back-and-forth between the LLM and tool execution.
 * When the LLM decides to call a tool, the loop:
 *   1. Executes the function via TOOL_MAP
 *   2. Feeds the result back to the LLM
 *   3. Repeats until the LLM produces a final text response
 */

import { TOOL_MAP, toolSchemas } from "./registry";
import Groq from "groq-sdk";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "groq-sdk/resources/chat/completions";

const MAX_TOOL_ROUNDS = 5; // safety limit to prevent infinite loops

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
): Promise<string> {
  const groq = getGroqClient();
  const model = process.env.GROQ_CHAT_MODEL || "llama-3.1-8b-instant";

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...userMessages,
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await groq.chat.completions.create({
      model,
      messages,
      tools: toolSchemas as ChatCompletionTool[],
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    // If no tool calls → we have our final answer
    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      return assistantMessage.content || "";
    }

    // Append the assistant's message (with tool calls) to the conversation
    messages.push(assistantMessage);

    // Execute each tool call and append results
    for (const toolCall of assistantMessage.tool_calls) {
      const fnName = toolCall.function.name;
      const fnArgs = JSON.parse(toolCall.function.arguments || "{}");

      console.log(`🔧 Tool call: ${fnName}(${JSON.stringify(fnArgs)})`);

      let result: unknown;
      try {
        const executor = TOOL_MAP[fnName];
        if (!executor) {
          result = { error: `Unknown tool: ${fnName}` };
        } else {
          result = await executor(fnArgs);
        }
      } catch (error) {
        result = {
          error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }

      console.log(
        `✅ Tool result: ${JSON.stringify(result).substring(0, 200)}...`,
      );

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
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
  });

  return fallback.choices[0]?.message?.content || "I could not complete the request.";
}

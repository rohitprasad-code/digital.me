import { LLMProvider, ChatMessage } from "./provider";
import { registry } from "../registry";

const MAX_ROUNDS = 5;

export async function runAgentLoop(
  provider: LLMProvider,
  systemPrompt: string,
  userMessages: ChatMessage[],
  maxRounds = MAX_ROUNDS
): Promise<string> {
  const toolsList = registry.listTools().map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));

  const toolPrompt = `
You have access to the following tools:
${JSON.stringify(toolsList, null, 2)}

To call a tool, respond with a JSON block in this exact format:
\`\`\`json
{
  "tool": "tool_name",
  "arguments": { "arg1": "value" }
}
\`\`\`

When you have the final answer, output it directly without using the JSON block.
`;

  const messages: ChatMessage[] = [
    { role: "system", content: `${systemPrompt}\n${toolPrompt}` },
    ...userMessages,
  ];

  for (let round = 0; round < maxRounds; round++) {
    const response = await provider.chat(messages);
    const content = response.content;

    const jsonMatch = content.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (!jsonMatch) {
      return content;
    }

    let toolCall: { tool: string; arguments: Record<string, any> };
    try {
      toolCall = JSON.parse(jsonMatch[1]);
    } catch (e) {
      messages.push({ role: "assistant", content });
      messages.push({
        role: "user",
        content: `Error: Invalid JSON format in tool call block. Please try again.`,
      });
      continue;
    }

    const tool = registry.getTool(toolCall.tool);
    if (!tool) {
      messages.push({ role: "assistant", content });
      messages.push({
        role: "user",
        content: `Error: Tool "${toolCall.tool}" not found. Available tools: ${registry.listTools().map((t) => t.name).join(", ")}`,
      });
      continue;
    }

    messages.push({ role: "assistant", content });

    try {
      const result = await tool.execute(toolCall.arguments);
      messages.push({
        role: "user",
        content: `Tool "${toolCall.tool}" returned result:\n${JSON.stringify(result, null, 2)}`,
      });
    } catch (err) {
      messages.push({
        role: "user",
        content: `Error: Tool execution failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const finalSummaryResponse = await provider.chat([
    ...messages,
    {
      role: "user",
      content: "Please summarize the tool results and provide the final answer.",
    },
  ]);

  return finalSummaryResponse.content;
}

import { NextRequest } from "next/server";
import { getLLMProvider } from "@/model/llm/provider";
import {
  getSystemPrompt,
  ContextMode,
  isValidMode,
} from "@/model/prompts/core";
import { VectorStore } from "@/memory/vector_store";
import { MemoryRouter } from "@/memory/router";
import { runAgentLoop } from "@/model/tools/agent";

const vectorStore = new VectorStore();
const router = new MemoryRouter();

export async function GET() {
  try {
    const provider = getLLMProvider();
    await provider.healthCheck();
    return new Response("Digital-Me <Chat> is running");
  } catch (error) {
    console.error("Health check failed:", error);
    return new Response("Service Unavailable: AI Backend is offline", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, mode, provider } = await req.json();

    // Validate mode if provided
    if (mode && !isValidMode(mode)) {
      return new Response(
        JSON.stringify({
          error: `Invalid mode: "${mode}". Must be one of: recruiter, social, default`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    let contextString = "";
    let detectedMode: ContextMode = mode || "default";

    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "user") {
        // Auto-detect intent if no explicit mode was provided
        if (!mode) {
          detectedMode = await router.detectIntent(lastMessage.content);
        }

        try {
          await vectorStore.load();
          const results = await vectorStore.search(lastMessage.content, 10);

          if (results.length > 0) {
            const retrievedContent = results
              .map((r) => r.doc.content)
              .join("\n---\n");
            contextString = `\n\nRelevant Context:\n${retrievedContent}`;
            console.log(
              `Retrieved ${results.length} relevant documents for context.`,
            );
          }
        } catch (err) {
          console.error("Failed to retrieve context:", err);
        }
      }
    }

    console.log(`Context mode: ${detectedMode}`);

    const systemPrompt = getSystemPrompt(detectedMode) + contextString;

    // Extract user/assistant messages (exclude any prior system messages)
    const conversationMessages = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }),
    );

    // Use agent loop with tool calling (Groq provider)
    // Falls back to regular streaming for non-Groq providers
    const isGroqProvider =
      (provider || process.env.LLM_PROVIDER || "groq").toLowerCase() ===
      "groq";

    if (isGroqProvider) {
      try {
        const agentResponse = await runAgentLoop(
          systemPrompt,
          conversationMessages,
        );

        // Stream the agent's final response character by character for consistency
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(agentResponse));
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Transfer-Encoding": "chunked",
          },
        });
      } catch (agentError) {
        console.error("Agent loop failed, falling back to streaming:", agentError);
        // Fall through to regular streaming below
      }
    }

    // Fallback: regular streaming without tool calling (for Ollama, Gemini, etc.)
    const allMessages = [
      {
        role: "system" as const,
        content: systemPrompt,
      },
      ...messages,
    ];

    const llmProvider = getLLMProvider(provider);

    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of llmProvider.chatStream(allMessages)) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Error in chat route:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

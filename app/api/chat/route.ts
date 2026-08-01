import { NextRequest, NextResponse } from "next/server";
import { getLLMProvider } from "@/model/providers/provider";
import {
  getSystemPrompt,
  ContextMode,
  isValidMode,
} from "@/model/prompts/core";
import { VectorStore } from "@/memory/vector_store";
import { MemoryRouter } from "@/memory/router";
import { runAgentLoop } from "@/model/agents/groq_agent";
import { runAgentLoop as runJsonAgentLoop } from "@/model/agents/json_agent";
import { initializeMcpTools, isInitialized } from "@/model/registry/tools";
import { registry } from "@/model/registry/unified";

import { verifyGrounding } from "@/model/middleware/grounding";

const vectorStore = new VectorStore();
const router = new MemoryRouter();

export async function GET() {
  try {
    const provider = getLLMProvider();
    await provider.healthCheck();
    return NextResponse.json({ status: "running", message: "Digital-Me (Chat) is running" });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      { error: "Service Unavailable: AI Backend is offline" },
      {
        status: 503,
        statusText: "Service Unavailable",
      }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication headers
    const authPasscode = req.headers.get("x-auth-passcode");
    const customApiKey = req.headers.get("x-custom-api-key");
    const isAuthenticated =
      authPasscode === "developer" ||
      (!!customApiKey && customApiKey.trim().length > 0);

    const isRateLimitEnabled = process.env.ENABLE_RATE_LIMIT === "true";
    let chatCount = 0;
    if (isRateLimitEnabled && !isAuthenticated) {
      const countCookie = req.cookies.get("free_chat_count");
      chatCount = parseInt(countCookie?.value || "0", 10);
      if (chatCount >= 5) {
        return new Response(
          JSON.stringify({
            error: "Free tier limit reached. Please authenticate to unlock.",
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

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

    const systemPrompt = getSystemPrompt(detectedMode) + contextString + "\n\nIMPORTANT: Keep your response short, direct, and on-point (maximum 1-2 sentences). Avoid writing long paragraphs.";

    // Extract user/assistant messages (exclude any prior system messages)
    const conversationMessages = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }),
    );

    // Initialize MCP tools if not already initialized
    if (!isInitialized) {
      try {
        await initializeMcpTools();
      } catch (mcpErr) {
        console.error("Failed to initialize MCP tools during chat:", mcpErr);
      }
    }

    // Use agent loop with tool calling
    const selectedProvider = provider || process.env.LLM_PROVIDER || "groq";
    const isGroqProvider = selectedProvider.toLowerCase() === "groq";

    let finalResponseText = "";
    let ranAgent = false;

    if (isGroqProvider) {
      try {
        let agentResponse = await runAgentLoop(
          systemPrompt,
          conversationMessages,
        );
        ranAgent = true;

        // Grounding guardrail check for Groq
        if (contextString.trim().length > 0) {
          const grounding = await verifyGrounding(contextString, agentResponse, selectedProvider);
          if (!grounding.safe) {
            console.warn(`⚠️ Factual grounding violation detected: ${grounding.feedback}. Initiating correction loop...`);
            const correctivePrompt = `${systemPrompt}\n\n⚠️ GROUNDING WARNING: Your previous response contained claims not supported by the context: "${grounding.feedback}". Rewriting response to be 100% grounded in the Context.`;
            agentResponse = await runAgentLoop(correctivePrompt, conversationMessages);
          }
        }
        finalResponseText = agentResponse;
      } catch (agentError) {
        console.error("Groq Agent loop failed, falling back:", agentError);
      }
    } else {
      // For non-Groq providers, run the JSON-based agent loop if tools are registered
      const registeredTools = registry.listTools();
      if (registeredTools.length > 0) {
        try {
          const llmProvider = getLLMProvider(selectedProvider);
          let agentResponse = await runJsonAgentLoop(
            llmProvider,
            systemPrompt,
            conversationMessages,
          );
          ranAgent = true;

          // Grounding guardrail check for JSON agent
          if (contextString.trim().length > 0) {
            const grounding = await verifyGrounding(contextString, agentResponse, selectedProvider);
            if (!grounding.safe) {
              console.warn(`⚠️ Factual grounding violation detected: ${grounding.feedback}. Initiating correction loop...`);
              const correctivePrompt = `${systemPrompt}\n\n⚠️ GROUNDING WARNING: Your previous response contained claims not supported by the context: "${grounding.feedback}". Rewriting response to be 100% grounded in the Context.`;
              agentResponse = await runJsonAgentLoop(llmProvider, correctivePrompt, conversationMessages);
            }
          }
          finalResponseText = agentResponse;
        } catch (agentError) {
          console.error("JSON Agent loop failed, falling back:", agentError);
        }
      }
    }

    // Fallback: regular chat without tool calling (for Ollama, Gemini, etc.) if agent loop wasn't run or failed
    if (!ranAgent || !finalResponseText) {
      try {
        const llmProvider = getLLMProvider(selectedProvider);
        const allMessages = [
          {
            role: "system" as const,
            content: systemPrompt,
          },
          ...messages,
        ];
        const res = await llmProvider.chat(allMessages);
        let fallbackResponse = res.content;

        // Grounding guardrail check for fallback
        if (contextString.trim().length > 0) {
          const grounding = await verifyGrounding(contextString, fallbackResponse, selectedProvider);
          if (!grounding.safe) {
            console.warn(`⚠️ Factual grounding violation detected: ${grounding.feedback}. Initiating correction loop...`);
            const correctionMessages = [
              {
                role: "system" as const,
                content: `${systemPrompt}\n\n⚠️ GROUNDING WARNING: Your previous response contained claims not supported by the context: "${grounding.feedback}". Rewriting response to be 100% grounded in the Context.`,
              },
              ...messages,
            ];
            const correctedRes = await llmProvider.chat(correctionMessages);
            fallbackResponse = correctedRes.content;
          }
        }
        finalResponseText = fallbackResponse;
      } catch (err) {
        console.error("Fallback chat flow failed:", err);
        finalResponseText = "I'm sorry, I could not verify that information in my local memory.";
      }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(finalResponseText));
        controller.close();
      },
    });

    const response = new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });

    if (isRateLimitEnabled && !isAuthenticated) {
      response.headers.set(
        "Set-Cookie",
        `free_chat_count=${chatCount + 1}; Path=/; Max-Age=86400; HttpOnly; SameSite=Strict`,
      );
    }

    return response;
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

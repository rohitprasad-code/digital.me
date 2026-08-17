import Groq from "groq-sdk";
import type {
  LLMProvider,
  ChatMessage,
  ChatOptions,
  ChatResponse,
} from "../provider";
import type { EmbeddingProvider } from "../embeddings";
import { getBestGroqModel } from "./model_selector";

function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Get one from https://console.groq.com/keys",
    );
  }
  return new Groq({ apiKey });
}

export class GroqProvider implements LLMProvider {
  async chat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const groq = getGroqClient();
    const modelName =
      options?.model || (await getBestGroqModel(groq));

    const response = await groq.chat.completions.create({
      messages: messages as { role: "system" | "user" | "assistant"; content: string }[],
      model: modelName,
      stream: false,
      ...({ reasoning_effort: "none" } as Record<string, unknown>),
    });

    let content = response.choices[0]?.message?.content || "";
    content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    return { content };
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncIterable<string> {
    const groq = getGroqClient();
    const modelName =
      options?.model || (await getBestGroqModel(groq));

    const stream = await groq.chat.completions.create({
      messages: messages as { role: "system" | "user" | "assistant"; content: string }[],
      model: modelName,
      stream: true,
      ...({ reasoning_effort: "none" } as Record<string, unknown>),
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        yield text;
      }
    }
  }

  async healthCheck(): Promise<void> {
    const groq = getGroqClient();
    const modelName = await getBestGroqModel(groq);

    // Lightweight call to verify connectivity
    await groq.chat.completions.create({
      messages: [{ role: "user", content: "ping" }],
      model: modelName,
      max_tokens: 5,
    });
  }
}

const DEFAULT_EMBEDDING_MODEL = "nomic-embed-text-v1_5";

export class GroqEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    const groq = getGroqClient();
    const modelName =
      process.env.GROQ_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;

    const response = await groq.embeddings.create({
      input: text,
      model: modelName,
    });

    return response.data[0].embedding as number[];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const groq = getGroqClient();
    const modelName =
      process.env.GROQ_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;

    const response = await groq.embeddings.create({
      input: texts,
      model: modelName,
    });

    return response.data.map((d) => d.embedding as number[]);
  }
}

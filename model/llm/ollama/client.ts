import { Ollama } from "ollama";
import type {
  LLMProvider,
  ChatMessage,
  ChatOptions,
  ChatResponse,
} from "../provider";
import type { EmbeddingProvider } from "../embeddings";

export const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || "http://127.0.0.1:11434",
});

const DEFAULT_CHAT_MODEL = "llama3";
const DEFAULT_EMBEDDING_MODEL = "nomic-embed-text";

export class OllamaProvider implements LLMProvider {
  async chat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const response = await ollama.chat({
      model: options?.model || DEFAULT_CHAT_MODEL,
      messages,
      stream: false,
      ...(options?.format ? { format: options.format } : {}),
    });

    return { content: response.message.content };
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncIterable<string> {
    const response = await ollama.chat({
      model: options?.model || DEFAULT_CHAT_MODEL,
      messages,
      stream: true,
    });

    for await (const part of response) {
      yield part.message.content;
    }
  }

  async healthCheck(): Promise<void> {
    await ollama.list();
  }
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    const response = await ollama.embeddings({
      model: DEFAULT_EMBEDDING_MODEL,
      prompt: text,
    });
    return response.embedding;
  }
}

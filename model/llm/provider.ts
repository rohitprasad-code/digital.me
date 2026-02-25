export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model?: string;
  stream?: boolean;
  format?: string;
}

export interface ChatResponse {
  content: string;
}

export interface LLMProvider {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;

  chatStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncIterable<string>;

  healthCheck(): Promise<void>;
}

let _cachedProvider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (_cachedProvider) return _cachedProvider;

  const provider = (process.env.LLM_PROVIDER || "ollama").toLowerCase();

  switch (provider) {
    case "gemini": {
      const { GeminiProvider } = require("./gemini/client");
      _cachedProvider = new GeminiProvider();
      break;
    }
    case "ollama":
    default: {
      const { OllamaProvider } = require("./ollama/client");
      _cachedProvider = new OllamaProvider();
      break;
    }
  }

  return _cachedProvider!;
}

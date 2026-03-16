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
let _currentProviderName: string | null = null;

export function getLLMProvider(providerName?: string): LLMProvider {
  const provider = (
    providerName ||
    process.env.LLM_PROVIDER ||
    "groq"
  ).toLowerCase();

  // Return cached if it's the same provider
  if (_cachedProvider && _currentProviderName === provider) {
    return _cachedProvider;
  }

  switch (provider) {
    case "gemini": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GeminiProvider } = require("./gemini/client");
      _cachedProvider = new GeminiProvider();
      break;
    }
    case "groq": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GroqProvider } = require("./groq/client");
      _cachedProvider = new GroqProvider();
      break;
    }
    case "ollama":
    default: {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { OllamaProvider } = require("./ollama/client");
      _cachedProvider = new OllamaProvider();
      break;
    }
  }

  _currentProviderName = provider;
  return _cachedProvider!;
}

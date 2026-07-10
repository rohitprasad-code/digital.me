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

export const AVAILABLE_PROVIDERS = [
  { id: "groq", name: "Groq (Fast)" },
  { id: "gemini", name: "Gemini (Google)" },
  { id: "ollama", name: "Ollama (Local)" },
];

class FallbackLLMProvider implements LLMProvider {
  private providers: { name: string; getProvider: () => LLMProvider }[];

  constructor(preferredName: string) {
    const allProviders = [
      {
        name: "groq",
        getProvider: () => {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { GroqProvider } = require("./groq/client");
          return new GroqProvider();
        },
      },
      {
        name: "gemini",
        getProvider: () => {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { GeminiProvider } = require("./gemini/client");
          return new GeminiProvider();
        },
      },
      {
        name: "ollama",
        getProvider: () => {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { OllamaProvider } = require("./ollama/client");
          return new OllamaProvider();
        },
      },
    ];

    const preferred = allProviders.find((p) => p.name === preferredName);
    const rest = allProviders.filter((p) => p.name !== preferredName);
    this.providers = preferred ? [preferred, ...rest] : allProviders;
  }

  async chat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    let lastError: unknown = null;
    for (const p of this.providers) {
      try {
        const providerInstance = p.getProvider();
        return await providerInstance.chat(messages, options);
      } catch (err) {
        console.warn(
          `LLM provider "${p.name}" chat failed: ${
            err instanceof Error ? err.message : String(err)
          }. Trying fallback...`,
        );
        lastError = err;
      }
    }
    throw new Error(
      `All LLM providers failed for chat. Last error: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncIterable<string> {
    let success = false;
    let lastError: unknown = null;

    for (const p of this.providers) {
      try {
        const providerInstance = p.getProvider();
        const stream = providerInstance.chatStream(messages, options);
        
        const iterator = stream[Symbol.asyncIterator]();
        const firstResult = await iterator.next();
        
        if (!firstResult.done) {
          yield firstResult.value;
          
          let result = await iterator.next();
          while (!result.done) {
            yield result.value;
            result = await iterator.next();
          }
        }
        success = true;
        break;
      } catch (err) {
        console.warn(
          `LLM provider "${p.name}" chatStream failed: ${
            err instanceof Error ? err.message : String(err)
          }. Trying fallback...`,
        );
        lastError = err;
      }
    }

    if (!success) {
      throw new Error(
        `All LLM providers failed for chatStream. Last error: ${
          lastError instanceof Error ? lastError.message : String(lastError)
        }`,
      );
    }
  }

  async healthCheck(): Promise<void> {
    let healthy = false;
    let lastError: unknown = null;
    for (const p of this.providers) {
      try {
        const providerInstance = p.getProvider();
        await providerInstance.healthCheck();
        healthy = true;
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!healthy) {
      throw new Error(
        `No healthy LLM providers found. Last error: ${
          lastError instanceof Error ? lastError.message : String(lastError)
        }`,
      );
    }
  }
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

  _cachedProvider = new FallbackLLMProvider(provider);
  _currentProviderName = provider;
  return _cachedProvider;
}


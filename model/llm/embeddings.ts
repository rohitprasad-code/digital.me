export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

class FallbackEmbeddingProvider implements EmbeddingProvider {
  private providers: { name: string; getProvider: () => EmbeddingProvider }[];

  constructor(preferredName: string) {
    let groqInstance: EmbeddingProvider | null = null;
    let geminiInstance: EmbeddingProvider | null = null;
    let ollamaInstance: EmbeddingProvider | null = null;

    const allProviders = [
      {
        name: "groq",
        getProvider: () => {
          if (!groqInstance) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { GroqEmbeddingProvider } = require("./groq/client");
            groqInstance = new GroqEmbeddingProvider();
          }
          return groqInstance;
        },
      },
      {
        name: "gemini",
        getProvider: () => {
          if (!geminiInstance) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { GeminiEmbeddingProvider } = require("./gemini/client");
            geminiInstance = new GeminiEmbeddingProvider();
          }
          return geminiInstance;
        },
      },
      {
        name: "ollama",
        getProvider: () => {
          if (!ollamaInstance) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { OllamaEmbeddingProvider } = require("./ollama/client");
            ollamaInstance = new OllamaEmbeddingProvider();
          }
          return ollamaInstance;
        },
      },
    ];

    const preferred = allProviders.find((p) => p.name === preferredName);
    const rest = allProviders.filter((p) => p.name !== preferredName);
    this.providers = preferred ? [preferred, ...rest] : allProviders;
  }

  async embed(text: string): Promise<number[]> {
    let lastError: unknown = null;
    for (const p of this.providers) {
      try {
        const providerInstance = p.getProvider();
        return await providerInstance.embed(text);
      } catch (err) {
        console.warn(
          `Embedding provider "${p.name}" failed: ${
            err instanceof Error ? err.message : String(err)
          }. Trying fallback...`
        );
        lastError = err;
      }
    }
    throw new Error(
      `All embedding providers failed. Last error: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`
    );
  }
}

let _cachedEmbeddingProvider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (_cachedEmbeddingProvider) return _cachedEmbeddingProvider;

  const provider = (process.env.LLM_PROVIDER || "groq").toLowerCase();
  _cachedEmbeddingProvider = new FallbackEmbeddingProvider(provider);
  return _cachedEmbeddingProvider;
}


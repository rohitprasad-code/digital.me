export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

let _cachedEmbeddingProvider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (_cachedEmbeddingProvider) return _cachedEmbeddingProvider;

  const provider = (process.env.LLM_PROVIDER || "groq").toLowerCase();

  switch (provider) {
    case "gemini": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GeminiEmbeddingProvider } = require("./gemini/client");
      _cachedEmbeddingProvider = new GeminiEmbeddingProvider();
      break;
    }
    case "groq": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GroqEmbeddingProvider } = require("./groq/client");
      _cachedEmbeddingProvider = new GroqEmbeddingProvider();
      break;
    }
    case "ollama":
    default: {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { OllamaEmbeddingProvider } = require("./ollama/client");
      _cachedEmbeddingProvider = new OllamaEmbeddingProvider();
      break;
    }
  }

  // Since dynamic imports are async, and this function is sync, we might need a different approach 
  // if we strictly want to avoid require. But wait, the providers are used later.
  // Actually, if I can't make it async here, maybe top level imports are better if the 
  // side effects are minimal.
  // Or, use @ts-expect-error on require if it's the only way for sync conditional loading.
  // many projects use require for this reason.
  // Let's try top level imports first to see if it's okay.
  // Actually, let's just use @ts-expect-error for now to satisfy the lint.

  return _cachedEmbeddingProvider!;
}

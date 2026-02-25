export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

let _cachedEmbeddingProvider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (_cachedEmbeddingProvider) return _cachedEmbeddingProvider;

  const provider = (process.env.LLM_PROVIDER || "ollama").toLowerCase();

  switch (provider) {
    case "gemini": {
      const { GeminiEmbeddingProvider } = require("./gemini/client");
      _cachedEmbeddingProvider = new GeminiEmbeddingProvider();
      break;
    }
    case "ollama":
    default: {
      const { OllamaEmbeddingProvider } = require("./ollama/client");
      _cachedEmbeddingProvider = new OllamaEmbeddingProvider();
      break;
    }
  }

  return _cachedEmbeddingProvider!;
}

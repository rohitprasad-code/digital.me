export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

let _cachedEmbeddingProvider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (_cachedEmbeddingProvider) return _cachedEmbeddingProvider;

  const provider = (process.env.LLM_PROVIDER || "groq").toLowerCase();

  switch (provider) {
    case "gemini": {
      const { GeminiEmbeddingProvider } = require("./gemini/client");
      _cachedEmbeddingProvider = new GeminiEmbeddingProvider();
      break;
    }
    case "groq":
    // fall through to ollama -> reason : Groq currently does not host embedding models like nomic-embed-text-v1_5 on its developer API
    case "ollama":
    default: {
      const { OllamaEmbeddingProvider } = require("./ollama/client");
      _cachedEmbeddingProvider = new OllamaEmbeddingProvider();
      break;
    }
  }

  return _cachedEmbeddingProvider!;
}

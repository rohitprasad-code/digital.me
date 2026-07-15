import { getEmbeddingProvider } from "./embeddings";
import { getLLMProvider, LLMProvider } from "./provider";
import computeCosineSimilarity from "compute-cosine-similarity";

export interface SemanticRoute {
  name: string;
  providerName: string;
  examples: string[];
  exampleEmbeddings: number[][];
}

export class SemanticRouter {
  private routes: SemanticRoute[] = [];
  private defaultProviderName: string;

  constructor(defaultProviderName: string = "gemini") {
    this.defaultProviderName = defaultProviderName;
  }

  async addRoute(name: string, providerName: string, examples: string[]) {
    const embedder = getEmbeddingProvider();
    const embeddings = await Promise.all(
      examples.map((ex) => embedder.embed(ex))
    );
    this.routes.push({
      name,
      providerName,
      examples,
      exampleEmbeddings: embeddings,
    });
  }

  async route(query: string, threshold = 0.7): Promise<LLMProvider> {
    const embedder = getEmbeddingProvider();
    const queryEmbedding = await embedder.embed(query);

    let bestRoute: SemanticRoute | null = null;
    let highestSimilarity = -1;

    for (const route of this.routes) {
      for (const exampleEmbedding of route.exampleEmbeddings) {
        const sim = computeCosineSimilarity(queryEmbedding, exampleEmbedding);
        if (typeof sim === "number" && sim > highestSimilarity) {
          highestSimilarity = sim;
          bestRoute = route;
        }
      }
    }

    const selectedProviderName =
      bestRoute && highestSimilarity >= threshold
        ? bestRoute.providerName
        : this.defaultProviderName;

    return getLLMProvider(selectedProviderName);
  }
}

import { LLMProvider } from "./llm/provider";
import { EmbeddingProvider } from "./llm/embeddings";
import { ToolDefinition } from "./tools/types";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

export interface RegistryNode {
  id: string;
  type: "llm" | "embedding" | "tool" | "mcp";
}

export class UnifiedRegistry {
  private static instance: UnifiedRegistry;
  private llmProviders = new Map<string, LLMProvider>();
  private embeddingProviders = new Map<string, EmbeddingProvider>();
  private tools = new Map<string, ToolDefinition>();
  private mcpClients = new Map<string, Client>();

  private constructor() {}

  public static getInstance(): UnifiedRegistry {
    if (!UnifiedRegistry.instance) {
      UnifiedRegistry.instance = new UnifiedRegistry();
    }
    return UnifiedRegistry.instance;
  }

  // LLM Providers
  public registerLLMProvider(name: string, provider: LLMProvider): void {
    this.llmProviders.set(name.toLowerCase(), provider);
  }

  public getLLMProvider(name: string): LLMProvider {
    const provider = this.llmProviders.get(name.toLowerCase());
    if (!provider) {
      throw new Error(`LLM provider "${name}" is not registered in the Unified Registry.`);
    }
    return provider;
  }

  public listLLMProviders(): string[] {
    return Array.from(this.llmProviders.keys());
  }

  // Embedding Providers
  public registerEmbeddingProvider(name: string, provider: EmbeddingProvider): void {
    this.embeddingProviders.set(name.toLowerCase(), provider);
  }

  public getEmbeddingProvider(name: string): EmbeddingProvider {
    const provider = this.embeddingProviders.get(name.toLowerCase());
    if (!provider) {
      throw new Error(`Embedding provider "${name}" is not registered in the Unified Registry.`);
    }
    return provider;
  }

  public listEmbeddingProviders(): string[] {
    return Array.from(this.embeddingProviders.keys());
  }

  // Tools
  public registerTool(name: string, tool: ToolDefinition): void {
    this.tools.set(name, tool);
  }

  public getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public listTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  // MCP Clients
  public registerMcpClient(name: string, client: Client): void {
    this.mcpClients.set(name, client);
  }

  public getMcpClient(name: string): Client | undefined {
    return this.mcpClients.get(name);
  }

  public listMcpClients(): string[] {
    return Array.from(this.mcpClients.keys());
  }

  public clear(): void {
    this.llmProviders.clear();
    this.embeddingProviders.clear();
    this.tools.clear();
    this.mcpClients.clear();
  }
}

export const registry = UnifiedRegistry.getInstance();

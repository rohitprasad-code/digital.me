import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "fs";
import path from "path";
import { log } from "./logger";

export interface IngestTask {
  tool: string;
  args?: Record<string, unknown>;
  source: string;
  title?: string;
  itemTemplate?: string;
}

export interface ServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  allowedTools?: string[];
  ingest?: IngestTask[];
}

export interface McpConfig {
  mcpServers?: Record<string, ServerConfig>;
}

export class McpClientManager {
  private clients: Map<string, Client> = new Map();
  public config: McpConfig | null = null;

  private isCleanupRegistered = false;

  async init(relevantServers?: string[]) {
    const configPath = path.resolve(process.cwd(), "mcp_config.json");
    if (!fs.existsSync(configPath)) {
      log.warn("mcp_config.json not found, starting without MCP servers");
      return;
    }

    try {
      this.config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch (error) {
      log.error("Failed to parse mcp_config.json", error instanceof Error ? error.message : String(error));
      return;
    }

    const mcpServers = this.config?.mcpServers || {};
    const serversToConnect = relevantServers
      ? Object.keys(mcpServers).filter(name => relevantServers.includes(name))
      : Object.keys(mcpServers);

    for (const serverName of serversToConnect) {
      await this.getOrConnectClient(serverName);
    }

    if (this.clients.size > 0 && !this.isCleanupRegistered) {
      const cleanup = async () => {
        log.info("MCP /cleanup: Cleaning up MCP connections...");
        await this.close();
      };
      process.once("SIGINT", async () => {
        await cleanup();
        process.exit(0);
      });
      process.once("SIGTERM", async () => {
        await cleanup();
        process.exit(0);
      });
      this.isCleanupRegistered = true;
    }
  }

  async getOrConnectClient(serverName: string): Promise<Client | null> {
    if (this.clients.has(serverName)) {
      return this.clients.get(serverName)!;
    }

    const serverConfig = this.config?.mcpServers?.[serverName];
    if (!serverConfig) {
      return null;
    }

    try {
      log.info(`MCP /connecting: ${serverName}`);
      
      // Merge process.env with specific server environment variables
      const env: Record<string, string> = {};
      for (const [key, value] of Object.entries({
        ...process.env,
        ...(serverConfig.env || {}),
      })) {
        if (value !== undefined) {
          env[key] = value;
        }
      }

      const transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args,
        env,
        stderr: "ignore",
      });

      const client = new Client(
        { name: "digital-me-client", version: "1.0.0" },
        { capabilities: {} }
      );

      await client.connect(transport);

      // Security Guardrail: Wrap callTool to enforce allowedTools constraint at the client layer
      const originalCallTool = client.callTool.bind(client);
      client.callTool = async (params, options) => {
        const allowed = serverConfig.allowedTools;
        if (allowed && !allowed.includes(params.name)) {
          throw new Error(`Security Guardrail: Tool "${params.name}" is not in the allowedTools list for server "${serverName}".`);
        }
        return originalCallTool(params, options);
      };

      this.clients.set(serverName, client);
      log.success(`MCP /connected: ${serverName}`);
      return client;
    } catch (err) {
      log.error(`MCP /connection_failed: ${serverName}`, err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  getClients() {
    return this.clients;
  }

  async close() {
    for (const [name, client] of this.clients.entries()) {
      try {
        await client.close();
        log.info(`MCP /closed: ${name}`);
      } catch (err) {
        log.error(`MCP /close_failed: ${name}`, err instanceof Error ? err.message : String(err));
      }
    }
    this.clients.clear();
  }
}

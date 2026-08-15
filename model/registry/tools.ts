import { ToolDefinition, ToolParameters } from "./types";
import { McpClientManager } from "../../utils/mcp_client";
import { log } from "../../utils/logger";
import { registry } from "./unified";

export const mcpManager = new McpClientManager();

export const allToolDefinitions: ToolDefinition[] = [];
export const TOOL_MAP: Record<
  string,
  (args: Record<string, unknown>) => Promise<unknown>
> = {};

export const toolSchemas: Record<string, unknown>[] = [];
export let isInitialized = false;

export async function initializeMcpTools() {
  if (isInitialized) return;
  try {
    await mcpManager.init();
    isInitialized = true;
    
    // Clear existing tools
    allToolDefinitions.length = 0;
    toolSchemas.length = 0;
    for (const key of Object.keys(TOOL_MAP)) {
      delete TOOL_MAP[key];
    }

    const clients = mcpManager.getClients();
    const config = mcpManager.config || {};
    const mcpServers = config.mcpServers || {};

    for (const [serverName, client] of clients.entries()) {
      try {
        const serverConfig = mcpServers[serverName] || {};
        const allowedTools = Array.isArray(serverConfig.allowedTools) ? serverConfig.allowedTools : null;

        // Register the MCP Client in the Unified Registry
        registry.registerMcpClient(serverName, client);

        const response = await client.listTools();
        for (const tool of response.tools) {
          // Filter tools if allowedTools list is configured
          if (allowedTools && !allowedTools.includes(tool.name)) {
            continue;
          }

          // Namespace tools to prevent name collisions and replace dashes with underscores for compatibility (e.g. with Groq tool calling)
          const namespacedName = `${serverName}_${tool.name}`.replace(/-/g, "_");
          
          const definition: ToolDefinition = {
            name: namespacedName,
            description: tool.description || "",
            parameters: (tool.inputSchema || { type: "object", properties: {} }) as ToolParameters,
            execute: async (args) => {
              const sanitizedArgs = (args && typeof args === "object") ? args : {};
              const res = await client.callTool({
                name: tool.name,
                arguments: sanitizedArgs,
              });
              return res.content;
            },
          };

          allToolDefinitions.push(definition);
          TOOL_MAP[namespacedName] = definition.execute;

          // Register in the Unified Registry
          registry.registerTool(namespacedName, definition);

          toolSchemas.push({
            type: "function" as const,
            function: {
              name: namespacedName,
              description: tool.description,
              parameters: tool.inputSchema,
            },
          });
        }
      } catch (err) {
        log.error(`Failed to list tools for MCP server: ${serverName}`, err instanceof Error ? err.message : String(err));
      }
    }
    
    log.info(`Initialized dynamic MCP tools. Total tools registered: ${allToolDefinitions.length}`);
  } catch (error) {
    log.error("Failed to initialize MCP tools", error instanceof Error ? error.message : String(error));
  }
}

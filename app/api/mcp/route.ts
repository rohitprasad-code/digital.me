import { NextRequest } from "next/server";
import { initializeMcpTools, allToolDefinitions, TOOL_MAP, isInitialized } from "@/model/registry/tools";

export async function GET() {
  try {
    if (!isInitialized) {
      await initializeMcpTools();
    }

    const tools = allToolDefinitions.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    return new Response(
      JSON.stringify({
        initialized: isInitialized,
        totalTools: tools.length,
        tools,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Failed to fetch MCP tools:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch MCP tools", details: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isInitialized) {
      await initializeMcpTools();
    }

    const body = await req.json();
    const { toolName, arguments: toolArgs } = body;

    if (!toolName) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: toolName" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const executor = TOOL_MAP[toolName];
    if (!executor) {
      return new Response(
        JSON.stringify({
          error: `Tool "${toolName}" not found.`,
          availableTools: Object.keys(TOOL_MAP),
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Executing MCP tool: ${toolName} with args:`, toolArgs);
    const result = await executor(toolArgs || {});

    return new Response(
      JSON.stringify({
        success: true,
        tool: toolName,
        result,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error executing MCP tool:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to execute MCP tool",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

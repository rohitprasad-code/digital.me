/**
 * Tool Registry
 *
 * Central registry that aggregates tool definitions from all integrations.
 * Each integration exports its own tools array — they are combined here
 * into a unified registry the agent loop uses.
 *
 * To add tools for a new integration:
 *   1. Create `integrations/<service>/tools.ts` exporting a ToolDefinition[]
 *   2. Import and spread it into `allToolDefinitions` below
 */

import { ToolDefinition } from "./types";
import { stravaTools } from "../../integrations/strava/tools";
import { esp32Tools } from "../../integrations/esp32/tools";
import { githubTools } from "../../integrations/github/tools";

// ── Aggregate all tool definitions ──────────────────────────────────

const allToolDefinitions: ToolDefinition[] = [
  ...stravaTools,
  ...esp32Tools,
  ...githubTools,
];

// ── TOOL_MAP: name → execute function ───────────────────────────────

export const TOOL_MAP: Record<
  string,
  (args: Record<string, unknown>) => Promise<unknown>
> = {};

for (const tool of allToolDefinitions) {
  TOOL_MAP[tool.name] = tool.execute;
}

// ── Schema array for the LLM (Groq/OpenAI tool format) ─────────────

export const toolSchemas = allToolDefinitions.map((tool) => ({
  type: "function" as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  },
}));

export { allToolDefinitions };

/**
 * Tool Calling Types
 *
 * Defines the shape of a tool that the LLM can invoke.
 * Each integration (Strava, ESP32, etc.) exports an array of ToolDefinitions.
 */

export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
}

export interface ToolParameters {
  type: "object";
  properties: Record<string, ToolParameter>;
  required?: string[];
  [key: string]: unknown;
}

/**
 * A tool the LLM can call at runtime.
 *
 * - `name`        — unique identifier, e.g. "get_strava_activities"
 * - `description` — the LLM reads this to decide whether to call the tool
 * - `parameters`  — JSON Schema describing the expected input
 * - `execute`     — the async function that runs when the tool is invoked
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameters;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Shape returned by the LLM when it decides to call a tool.
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * The result of an LLM completion that may contain tool calls.
 */
export interface ToolCallResponse {
  /** If the LLM returned a final text answer */
  content: string | null;
  /** If the LLM wants to call one or more tools */
  toolCalls: ToolCall[];
  /** Whether the response is a final answer or needs tool execution */
  isToolCall: boolean;
}

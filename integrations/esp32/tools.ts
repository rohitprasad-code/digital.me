/**
 * ESP32 / Smart Bulb Tool Definitions
 *
 * Thin adapters that expose ESP32Client methods as LLM-callable tools.
 * All actual API logic lives in client.ts — no duplication.
 */

import { ToolDefinition } from "../../model/tools/types";
import { ESP32Client } from "./client";

const esp32 = new ESP32Client();

// ── Tool Definitions ────────────────────────────────────────────────

export const esp32Tools: ToolDefinition[] = [
  {
    name: "set_bulb_state",
    description:
      "Turns the smart light/bulb on or off. Use when the user asks to turn on/off lights, switch lights, or control lighting.",
    parameters: {
      type: "object",
      properties: {
        state: {
          type: "string",
          enum: ["on", "off"],
          description: "The desired state of the bulb — 'on' or 'off'.",
        },
      },
      required: ["state"],
    },
    execute: async (args) => {
      const state = args.state as "on" | "off";
      if (!state || !["on", "off"].includes(state)) {
        return { error: "Invalid state. Must be 'on' or 'off'." };
      }
      try {
        return await esp32.setBulbState(state);
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  },
  {
    name: "get_bulb_state",
    description:
      "Gets the current state of the smart light/bulb. Use when the user asks if the lights are on or off, or wants to check lighting status.",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: async () => {
      try {
        return await esp32.getBulbState();
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },
  },
];

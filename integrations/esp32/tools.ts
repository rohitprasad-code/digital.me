/**
 * ESP32 / Smart Bulb Tool Functions
 *
 * Controls smart lighting via an ESP32 device.
 * Requires BULB_API_URL environment variable pointing to the ESP32 endpoint.
 */

import { ToolDefinition } from "../../model/tools/types";

const BULB_API_URL = process.env.BULB_API_URL || "http://192.168.1.100";

/**
 * Turns a smart bulb on or off via the ESP32 API.
 */
async function setBulbState(args: Record<string, unknown>) {
  const state = args.state as "on" | "off";

  if (!state || !["on", "off"].includes(state)) {
    return { error: "Invalid state. Must be 'on' or 'off'." };
  }

  try {
    const response = await fetch(`${BULB_API_URL}/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `ESP32 responded with ${response.status}: ${errorText}`,
      };
    }

    return { success: true, state, message: `Bulb turned ${state}` };
  } catch (error) {
    return {
      success: false,
      error: `Could not reach ESP32 at ${BULB_API_URL}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Gets the current state of the smart bulb from the ESP32.
 */
async function getBulbState() {
  try {
    const response = await fetch(`${BULB_API_URL}/state`);

    if (!response.ok) {
      return { error: `ESP32 responded with ${response.status}` };
    }

    const data = await response.json();
    return { state: data.state || "unknown" };
  } catch (error) {
    return {
      error: `Could not reach ESP32 at ${BULB_API_URL}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

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
    execute: setBulbState,
  },
  {
    name: "get_bulb_state",
    description:
      "Gets the current state of the smart light/bulb. Use when the user asks if the lights are on or off, or wants to check lighting status.",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: getBulbState,
  },
];

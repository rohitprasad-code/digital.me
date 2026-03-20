/**
 * Strava Tool Definitions
 *
 * Thin adapters that expose StravaClient methods as LLM-callable tools.
 * All actual API logic lives in client.ts — no duplication.
 */

import { ToolDefinition } from "../../model/tools/types";
import { StravaClient } from "./client";

const strava = new StravaClient();

// ── Tool Definitions ────────────────────────────────────────────────

export const stravaTools: ToolDefinition[] = [
  {
    name: "get_strava_activities",
    description:
      "Fetches recent Strava activities (runs, rides, hikes, etc.) live from the Strava API. Use when the user asks about recent workouts, runs, rides, exercises, or fitness data.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description:
            "Number of recent activities to fetch. Defaults to 5, max 30.",
        },
      },
    },
    execute: async (args) => {
      const limit = (args.limit as number) || 5;
      return await strava.getRecentActivities(limit);
    },
  },
  {
    name: "get_strava_profile",
    description:
      "Fetches the live Strava athlete profile. Use when the user asks about Strava profile, athletic stats, or follower count from Strava specifically.",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: async () => {
      return await strava.getProfile();
    },
  },
];

/**
 * LinkedIn Tool Definitions
 *
 * Thin adapters that expose LinkedInClient methods as LLM-callable tools.
 * All actual API logic lives in client.ts — no duplication.
 */

import { ToolDefinition } from "../../model/tools/types";
import { LinkedInClient } from "./client";
import { ensureValidToken } from "./auth";

async function getClient() {
  const token = await ensureValidToken();
  return new LinkedInClient(token);
}

// ── Tool Definitions ────────────────────────────────────────────────

export const linkedinTools: ToolDefinition[] = [
  {
    name: "get_linkedin_profile",
    description:
      "Fetches the live LinkedIn profile. Use when the user asks about LinkedIn profile, professional info, or LinkedIn-specific details.",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: async () => {
      const client = await getClient();
      return await client.getProfile();
    },
  },
];

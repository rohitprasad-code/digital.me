/**
 * GitHub Tool Definitions
 *
 * Thin adapters that expose GitHubClient methods as LLM-callable tools.
 * All actual API logic lives in client.ts — no duplication.
 */

import { ToolDefinition } from "../../model/tools/types";
import { GitHubClient } from "./client";

const github = new GitHubClient();

// ── Tool Definitions ────────────────────────────────────────────────

export const githubTools: ToolDefinition[] = [
  {
    name: "get_github_profile",
    description:
      "Fetches the live GitHub profile. Use when the user asks about GitHub account, repos count, followers, or GitHub bio.",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: async () => {
      return await github.getProfile();
    },
  },
  {
    name: "get_github_repos",
    description:
      "Fetches recent GitHub repositories. Use when the user asks about projects, repos, code, or what they've been working on in GitHub.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of recent repos to fetch. Defaults to 5.",
        },
      },
    },
    execute: async (args) => {
      const limit = (args.limit as number) || 5;
      return await github.getRecentRepos(limit);
    },
  },
  {
    name: "get_github_activity",
    description:
      "Fetches recent GitHub activity (pushes, PRs, issues). Use when the user asks about recent commits, contributions, or GitHub activity.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of recent events to fetch. Defaults to 10.",
        },
      },
    },
    execute: async (args) => {
      const limit = (args.limit as number) || 10;
      return await github.getRecentActivity(limit);
    },
  },
];

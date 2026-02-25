import fs from "fs/promises";
import path from "path";
import { logEvent } from "../../utils/logger";
import { GitHubClient } from "./client";
import { VectorStore } from "../../memory/vector_store";

export async function ingestGitHub(vectorStore: VectorStore) {
  console.log("Ingesting GitHub data...");
  try {
    const github = new GitHubClient();
    const githubData: any = {};

    // 1. Profile
    const profile = await github.getProfile();
    if (profile) {
      githubData.profile = profile;
      const content = `GitHub Profile: ${profile.name} (@${profile.login})\nBio: ${profile.bio}\nStats: ${profile.public_repos} repos, ${profile.followers} followers\nURL: ${profile.html_url}`;
      await vectorStore.addDocument(content, {
        source: "github",
        type: "github_profile",
      });
    }

    // 2. Repos
    const repos = await github.getRecentRepos(5);
    if (repos) {
      githubData.repos = repos;
      for (const repo of repos) {
        const content = `GitHub Repository: ${repo.name}\nDescription: ${repo.description}\nLanguage: ${repo.language}\nStars: ${repo.stars}\nUpdated: ${repo.updated_at}\nURL: ${repo.html_url}`;
        await vectorStore.addDocument(content, {
          source: "github",
          type: "github_repo",
          name: repo.name,
        });
      }
    }

    // 3. Activity
    const activities = await github.getRecentActivity(10);
    if (activities) {
      githubData.activities = activities;
      if (activities.length > 0) {
        const activitySummary = activities
          .map((a) => `- ${a.type} on ${a.repo} at ${a.created_at}`)
          .join("\n");
        const content = `Recent GitHub Activity:\n${activitySummary}`;
        await vectorStore.addDocument(content, {
          source: "github",
          type: "github_activity",
        });
      }
    }

    // Save GitHub data to JSON file
    const githubJsonPath = path.resolve(
      process.cwd(),
      "memory/memory_type/dynamic/github.json",
    );
    await fs.mkdir(path.dirname(githubJsonPath), { recursive: true });
    await fs.writeFile(githubJsonPath, JSON.stringify(githubData, null, 2));
    console.log(`Saved GitHub data to ${githubJsonPath}`);

    console.log("Successfully ingested GitHub data.");
    await logEvent("ingest", "Successfully ingested GitHub data");
  } catch (error) {
    console.warn(
      "Skipping GitHub ingestion:",
      error instanceof Error ? error.message : "Unknown error",
    );
    await logEvent("ingest", "Skipping GitHub ingestion", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

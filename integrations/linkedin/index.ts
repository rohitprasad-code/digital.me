import fs from "fs/promises";
import path from "path";
import { log } from "../../utils/logger";
import { DYNAMIC_DIR } from "../../utils/paths";
import { LinkedInClient } from "./client";
import { ensureValidToken } from "./token";
import { EmbeddingPipeline } from "../../jobs/embedding_pipeline";

export async function ingestLinkedIn(pipeline: EmbeddingPipeline) {
  try {
    const accessToken = await ensureValidToken();
    const linkedin = new LinkedInClient(accessToken);
    const linkedinData: Record<string, unknown> = {};

    // 1. Profile
    const profile = await linkedin.getProfile();
    if (profile) {
      linkedinData.profile = profile;
      const content = `LinkedIn Profile: ${profile.name}\nHeadline: ${profile.headline || "N/A"}\nProfessional Profile of ${profile.name}`;
      await pipeline.syncDocument(content, {
        source: "linkedin",
        type: "linkedin_profile",
      });
    }

    // Save LinkedIn data to JSON file
    const linkedinJsonPath = path.join(DYNAMIC_DIR, "linkedin.json");
    await fs.mkdir(path.dirname(linkedinJsonPath), { recursive: true });
    await fs.writeFile(linkedinJsonPath, JSON.stringify(linkedinData, null, 2));

    log.success("Successfully ingested LinkedIn data");
  } catch (error) {
    log.warn(
      "Skipping LinkedIn ingestion",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

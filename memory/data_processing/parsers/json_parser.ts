import fs from "fs/promises";
import path from "path";
import { log } from "../../../utils/logger";
import { STATIC_DIR } from "../../../utils/paths";
import { EmbeddingPipeline } from "../../../jobs/embedding_pipeline";

export class JsonParser {
  static async parse(filePath: string, pipeline: EmbeddingPipeline) {
    try {
      const filename = path.basename(filePath);
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);

      if (data.profile) {
        await pipeline.syncDocument(
          `Profile: ${JSON.stringify(data.profile)}`,
          {
            source: filename,
            type: "profile",
          },
          content,
        );
      }
      if (data.skills) {
        await pipeline.syncDocument(
          `Skills: ${data.skills.join(", ")}`,
          {
            source: filename,
            type: "skills",
          },
          content,
        );
      }
      if (data.interests) {
        await pipeline.syncDocument(
          `Interests: ${data.interests.join(", ")}`,
          {
            source: filename,
            type: "interests",
          },
          content,
        );
      }
      if (data.goals) {
        await pipeline.syncDocument(
          `Goals: ${data.goals.join(", ")}`,
          {
            source: filename,
            type: "goals",
          },
          content,
        );
      }

      const targetPath = path.join(STATIC_DIR, filename);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, JSON.stringify(data, null, 2));

      log.success("Successfully ingested " + filename);
    } catch (error) {
      log.error(
        "Error ingesting static JSON " + filePath,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }
}

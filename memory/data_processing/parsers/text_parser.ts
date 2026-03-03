import fs from "fs/promises";
import path from "path";
import { log } from "../../../utils/logger";
import { STATIC_DIR } from "../../../utils/paths";
import { EmbeddingPipeline } from "../../../jobs/embedding_pipeline";
import { UnstructuredConverter } from "../unstructured_converter";
import { processDocument } from "../index";

export class TextParser {
  static async parse(
    filePath: string,
    role: string,
    pipeline: EmbeddingPipeline,
  ) {
    try {
      const filename = path.basename(filePath);
      const content = await fs.readFile(filePath, "utf-8");

      if (role === "unstructured") {
        const structuredData =
          await UnstructuredConverter.extractStructuredData(content, filename);
        if (structuredData) {
          const jsonName = filename + ".json";
          const staticPath = path.join(STATIC_DIR, jsonName);
          await fs.mkdir(path.dirname(staticPath), { recursive: true });
          await fs.writeFile(
            staticPath,
            JSON.stringify(structuredData, null, 2),
          );
          log.success(
            `Saved extracted structure for ${filename} to ${staticPath}`,
          );

          const metaContent = `Metadata for ${filename}:\nTitle: ${structuredData.title}\nSummary: ${structuredData.summary}\nTopics: ${(structuredData.topics || []).join(", ")}`;
          await pipeline.syncDocument(
            metaContent,
            {
              source: filename,
              type: "metadata",
            },
            content,
          );
        }
      }

      const chunks = processDocument(content, filename);

      for (const chunk of chunks) {
        if (chunk.content.trim().length > 0) {
          await pipeline.syncDocument(chunk.content, {
            source: filename,
            type: role === "code" ? "code" : "document",
            fallback: false,
            ...chunk.metadata,
          });
        }
      }

      log.success(
        `Ingested ${filename} via structure-aware chunking (${chunks.length} chunks)`,
      );
    } catch (error) {
      log.error(
        `Error processing generic text ${filePath}`,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }
}

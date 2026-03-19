import path from "path";
import { log } from "../utils/logger";
import { VectorStore } from "./vector_store/index";
import { integrators } from "../integrations";
import {
  crawlDirectory,
  determineFileRole,
} from "./data_processing/directory_crawler";
import { EmbeddingPipeline } from "../jobs/embedding_pipeline";

import { JsonParser } from "./data_processing/parsers/json_parser";
import { PdfParser } from "./data_processing/parsers/pdf_parser";
import { TextParser } from "./data_processing/parsers/text_parser";
import { HtmlParser } from "./data_processing/parsers/html_parser";

async function ingest() {
  log.info("Ingestion started");
  const vectorStore = new VectorStore();

  // Load existing vectors (we DO NOT clear it anymore, so we can do incremental syncs)
  await vectorStore.load();

  const pipeline = new EmbeddingPipeline(vectorStore);

  const publicPath = path.resolve(process.cwd(), "public");

  try {
    const files = await crawlDirectory(publicPath);
    for (const filePath of files) {
      const role = determineFileRole(filePath);
      const ext = path.extname(filePath).toLowerCase();

      if (role === "pdf") {
        await PdfParser.parse(filePath, pipeline);
      } else if (role === "structured" && ext === ".json") {
        await JsonParser.parse(filePath, pipeline);
      } else if (role === "html") {
        await HtmlParser.parse(filePath, pipeline);
      } else if (
        role === "code" ||
        role === "unstructured" ||
        (role === "structured" && ext !== ".json")
      ) {
        await TextParser.parse(filePath, role, pipeline);
      } else {
        log.warn(`Skipping unknown or unsupported file format: \${filePath}`);
      }
    }
  } catch (err) {
    log.warn(
      "Could not read public directory. Might not exist or is empty.",
      err instanceof Error ? err.message : "Unknown error",
    );
  }

  for (const integrator of integrators) {
    try {
      await integrator.ingest(pipeline);
    } catch (err) {
      log.error(`Integrator ${integrator.name} failed`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Final step: clean up any old documents that weren't synced today
  // await pipeline.cleanupStaleDocuments();

  log.info("Ingestion complete!");
}

export { ingest };

if (require.main === module) {
  ingest().catch(async (err) => {
    log.error(
      "Ingestion failed",
      err instanceof Error ? err.message : "Unknown error",
    );
    process.exit(1);
  });
}

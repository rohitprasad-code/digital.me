import path from "path";
import { log } from "../utils/logger";
import { VectorStore } from "./vector_store/index";
import { initializeMcpTools, mcpManager, isInitialized } from "../model/tools/registry";
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

  if (!isInitialized) {
    await initializeMcpTools();
  }

  const clients = mcpManager.getClients();
  for (const [serverName, client] of clients.entries()) {
    try {
      log.info(`Syncing data from MCP Server: ${serverName}...`);
      
      // Sync through resources if available
      const resourcesRes = await client.listResources().catch(() => ({ resources: [] }));
      if (resourcesRes.resources && resourcesRes.resources.length > 0) {
        for (const resource of resourcesRes.resources) {
          try {
            const readRes = await client.readResource({ uri: resource.uri });
            if (readRes.contents) {
              for (const content of readRes.contents) {
                if ("text" in content && content.text) {
                  await pipeline.syncDocument(content.text, {
                    source: `mcp:${serverName}:${resource.uri}`,
                    title: resource.name,
                  });
                }
              }
            }
          } catch (resErr) {
            log.warn(`Failed to read MCP resource ${resource.uri}:`, resErr instanceof Error ? resErr.message : String(resErr));
          }
        }
      }

      // Explicit fallbacks for known servers if they don't use resources
      if (serverName === "strava") {
        try {
          const profile = (await client.callTool({ name: "get_athlete", arguments: {} }).catch(() => null)) as any;
          if (profile && profile.content) {
            await pipeline.syncDocument(JSON.stringify(profile.content), {
              source: "mcp:strava:profile",
              title: "Strava Athlete Profile",
            });
            log.success("Ingested Strava athlete profile via MCP tool");
          }

          const activities = (await client.callTool({ name: "get_activities", arguments: { limit: 10 } }).catch(() => null)) as any;
          if (activities && activities.content) {
            await pipeline.syncDocument(JSON.stringify(activities.content), {
              source: "mcp:strava:activities",
              title: "Strava Activities",
            });
            log.success("Ingested Strava activities via MCP tool");
          }
        } catch (toolErr) {
          log.warn("Failed to ingest Strava details using standard tools", toolErr);
        }
      }
    } catch (err) {
      log.error(`Failed to ingest from MCP server: ${serverName}`, err instanceof Error ? err.message : String(err));
    }
  }

  // Final step: clean up any old documents that weren't synced today
  // await pipeline.cleanupStaleDocuments();

  try {
    await mcpManager.close();
  } catch (err) {
    log.error("Failed to close MCP manager gracefully", err instanceof Error ? err.message : String(err));
  }

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

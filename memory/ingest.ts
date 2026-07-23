import path from "path";
import fs from "fs";
import { log } from "../utils/logger";
import { VectorStore } from "./vector_store/index";
import { initializeMcpTools, mcpManager, isInitialized } from "../model/registry/tools";
import {
  crawlDirectory,
  determineFileRole,
} from "./data_processing/directory_crawler";
import { EmbeddingPipeline } from "../jobs/embedding_pipeline";

import { JsonParser } from "./data_processing/parsers/json_parser";
import { PdfParser } from "./data_processing/parsers/pdf_parser";
import { TextParser } from "./data_processing/parsers/text_parser";
import { HtmlParser } from "./data_processing/parsers/html_parser";
import { transformMcpDataToNarrative } from "./data_processing/mcp_transformer";

async function ingest() {
  log.info("Ingestion started");
  const vectorStore = new VectorStore();

  // Load existing vectors (we DO NOT clear it anymore, so we can do incremental syncs)
  await vectorStore.load();

  let lastSyncTime = new Date(0);
  try {
    const allDocs = await vectorStore.getAllDocuments();
    const syncTimeDoc = allDocs.find((d) => d.metadata?.source === "system:last_sync_marker");
    if (syncTimeDoc && syncTimeDoc.metadata?.timestamp) {
      lastSyncTime = new Date(syncTimeDoc.metadata.timestamp as string);
    }
  } catch (err) {
    log.warn("Could not retrieve last sync time, defaulting to epoch:", err);
  }
  log.info(`Last successful sync time: ${lastSyncTime.toISOString()}`);

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

      // Dynamic Tool-Based Sync (fully generic)
      const configPath = path.resolve(process.cwd(), "mcp_config.json");
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          const serverConfig = config.mcpServers?.[serverName];
          if (serverConfig && Array.isArray(serverConfig.ingest)) {
            for (const task of serverConfig.ingest) {
              try {
                log.info(`Running ingest tool: ${task.tool} for ${serverName}...`);
                const taskArgs = { ...task.args };
                if (serverName === "strava" && (task.tool === "get_activities" || task.tool === "get_recent_activities")) {
                  const epochSecs = Math.floor(lastSyncTime.getTime() / 1000);
                  taskArgs.after = epochSecs;
                  log.info(`Injecting after=${epochSecs} epoch seconds for Strava differential sync.`);
                }

                const result = await client.callTool({
                  name: task.tool,
                  arguments: taskArgs,
                }).catch(() => null);

                if (result && typeof result === "object" && "content" in result) {
                  let content = (result as Record<string, unknown>).content;

                  // Differential filtering for GitHub repositories
                  if (serverName === "github" && task.tool === "list_repositories") {
                    let repos = Array.isArray(content)
                      ? content
                      : content && typeof content === "object" && Array.isArray((content as any).repositories)
                      ? (content as any).repositories
                      : null;

                    if (Array.isArray(repos)) {
                      const initialCount = repos.length;
                      repos = repos.filter((repo: any) => repo && repo.updated_at && new Date(repo.updated_at) > lastSyncTime);
                      log.info(`Differential sync: Filtered GitHub repositories from ${initialCount} to ${repos.length} based on last sync.`);
                      if (repos.length === 0) {
                        log.info(`No updated repositories since last sync. Skipping indexing.`);
                        continue;
                      }
                      if (Array.isArray(content)) {
                        content = repos;
                      } else {
                        (content as any).repositories = repos;
                      }
                    }
                  }

                  // Differential check for Strava activities returned (if any)
                  if (serverName === "strava" && (task.tool === "get_activities" || task.tool === "get_recent_activities")) {
                    let activities = Array.isArray(content)
                      ? content
                      : content && typeof content === "object" && Array.isArray((content as any).activities)
                      ? (content as any).activities
                      : null;

                    if (Array.isArray(activities) && activities.length === 0) {
                      log.info(`No new Strava activities since last sync. Skipping indexing.`);
                      continue;
                    }
                  }

                  const { contentText, rawData } = transformMcpDataToNarrative(content, serverName, task.tool, task);
                  await pipeline.syncDocument(contentText, {
                    source: `mcp:${serverName}:${task.source}`,
                    title: task.title || `${serverName} ${task.tool}`,
                    rawData,
                  });
                  log.success(`✓ Ingested ${task.tool} via MCP tool`);
                }
              } catch (taskErr) {
                log.warn(`Failed to run ingest tool "${task.tool}" for ${serverName}`, taskErr);
              }
            }
          }
        } catch (configErr) {
          log.error(`Failed to parse mcp_config.json for dynamic ingestion:`, configErr instanceof Error ? configErr.message : String(configErr));
        }
      }
    } catch (err) {
      log.error(`Failed to ingest from MCP server: ${serverName}`, err instanceof Error ? err.message : String(err));
    }
  }

  // Final step: clean up any old documents that weren't synced today
  // await pipeline.cleanupStaleDocuments();

  // Save system sync marker for future differential runs
  try {
    await pipeline.syncDocument("Last sync marker.", {
      source: "system:last_sync_marker",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    log.error("Failed to write system sync marker", err);
  }

  try {
    log.info("Saving vector store...");
    await vectorStore.save();
  } catch (err) {
    log.error("Failed to save vector store", err instanceof Error ? err.message : String(err));
  }

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

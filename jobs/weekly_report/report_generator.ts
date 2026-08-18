import fs from "fs";
import path from "path";
import { WEEKLY_REPORT_PROMPT } from "../../model/prompts/weekly_report";
import { getLLMProvider } from "../../model/providers/provider";
import { log, logger } from "../../utils/logger";
import { REPORTS_DIR } from "../../utils/paths";
import { VectorStore } from "../../memory/vector_store";

export interface ActivityData {
  start_date?: string;
  created_at?: string;
  date?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface McpSourceData {
  activities: ActivityData[];
  [key: string]: unknown;
}

export type ActivityFormatter = (act: ActivityData, dateFormatted: string) => string;

export const FORMATTERS: Record<string, ActivityFormatter> = {
  strava: (act, dateFormatted) => {
    const dist = act.distance ? `${(Number(act.distance) / 1000).toFixed(2)}km` : "";
    const time = act.moving_time ? `${Math.round(Number(act.moving_time) / 60)}mins` : "";
    const details = [dist, time].filter(Boolean).join(", ");
    return `- [${dateFormatted}] Strava Workout: "${act.name || act.type || "Workout"}" (${details})`;
  },
  github: (act, dateFormatted) => {
    const descStr = typeof act.description === "string" ? ` - ${act.description.substring(0, 150)}` : "";
    return `- [${dateFormatted}] GitHub Repository: "${act.name || "Repo"}"${descStr}`;
  },
  "presence-monitor": (act, dateFormatted) => {
    return `- [${dateFormatted}] System Presence: ${act.active_app || "Active"} (CPU: ${act.cpu_load_1m || "N/A"}, Memory: ${act.memory_used || "N/A"})`;
  }
};

export const defaultFormatter: ActivityFormatter = (act, dateFormatted) => {
  const title = act.title || act.name || act.type || act.text || "Log Entry";
  const desc = typeof act.text === "string" && act.text !== title 
    ? act.text 
    : (typeof act.description === "string" ? act.description : "");
  
  if (desc) {
    return `- [${dateFormatted}] ${title}: ${desc.substring(0, 200)}`;
  }

  // Fallback to serialization of interesting keys
  const keys = Object.keys(act).filter(k => !["start_date", "created_at", "date", "updated_at", "title", "name", "type", "text", "description"].includes(k));
  if (keys.length > 0) {
    const details = keys.slice(0, 3).map(k => `${k}: ${JSON.stringify(act[k])}`).join(", ");
    return `- [${dateFormatted}] ${title} (${details.substring(0, 150)})`;
  }

  return `- [${dateFormatted}] ${title}`;
};

export function registerFormatter(source: string, formatter: ActivityFormatter) {
  FORMATTERS[source] = formatter;
}


export async function generateWeeklyReport(): Promise<string> {
  logger.log("Report /generate");

  // 1. Collect Data from Vector Store (previously saved from MCP sync)
  const vectorStore = new VectorStore();
  const mcpData: Record<string, McpSourceData> = {};

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const now = new Date();

  try {
    await vectorStore.load();
    // 1. Filter on database level using sourcePrefix "mcp:"
    const mcpDocs = await vectorStore.getDocumentsByTimeRange(sevenDaysAgo, now, "mcp:");

    const seenIds = new Set<string>();

    for (const doc of mcpDocs) {
      const parts = (doc.metadata.source as string).split(":");
      const sourceName = parts[1]; // e.g. "github" or "strava"
      
      if (!mcpData[sourceName]) {
        mcpData[sourceName] = { activities: [] };
      }

      try {
        const rawContent = (doc.metadata?.rawData as string) || doc.content;
        const parsed = JSON.parse(rawContent);

        if (parsed && typeof parsed === "object") {
          const items = Array.isArray(parsed)
            ? parsed
            : (Array.isArray(parsed.activities)
            ? parsed.activities
            : Array.isArray(parsed.repositories)
            ? parsed.repositories
            : [parsed]);

          for (const item of items) {
            if (!item) continue;
            // Deduplicate based on unique attributes
            const itemId = String(item.id || item.name || item.text || JSON.stringify(item));
            if (seenIds.has(itemId)) continue;
            seenIds.add(itemId);

            mcpData[sourceName].activities.push(item);
          }
        }
      } catch {
        // Not JSON content, add as basic activity text
        const textKey = doc.content.trim();
        if (!seenIds.has(textKey)) {
          seenIds.add(textKey);
          mcpData[sourceName].activities.push({ text: doc.content });
        }
      }
    }

    // Chronological sorting & time window filtering
    for (const sourceName of Object.keys(mcpData)) {
      const data = mcpData[sourceName];
      if (data.activities && Array.isArray(data.activities)) {
        // Sort chronologically by date
        data.activities.sort((a, b) => {
          const dateA = new Date(a.start_date || a.created_at || a.date || a.updated_at || 0).getTime();
          const dateB = new Date(b.start_date || b.created_at || b.date || b.updated_at || 0).getTime();
          return dateA - dateB;
        });

        const recent = data.activities.filter((act) => {
          const dateStr = act.start_date || act.created_at || act.date || act.updated_at;
          if (!dateStr) return true; // Keep if no date found
          return new Date(dateStr) >= sevenDaysAgo;
        });

        mcpData[sourceName] = {
          ...data,
          recentActivitiesCount: recent.length,
          activities: recent,
        };
      }
    }
  } catch (error) {
    log.error(
      "Failed to read data from Vector Store:",
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  // Load name dynamically from me.json
  let name = "Rohit";
  try {
    const mePath = path.resolve(process.cwd(), "public/codes/me.json");
    if (fs.existsSync(mePath)) {
      const meConfig = JSON.parse(fs.readFileSync(mePath, "utf-8"));
      if (meConfig.profile?.name) {
        name = meConfig.profile.name.split(" ")[0];
      }
    }
  } catch {
    // Fall back silently
  }

  // Convert mcpData into highly token-efficient text bullets to prevent Groq TPM errors
  let bulletSummary = "";
  for (const [source, data] of Object.entries(mcpData)) {
    bulletSummary += `### Source: ${source.toUpperCase()} (Total synced: ${data.recentActivitiesCount})\n`;
    const activities = data.activities || [];
    if (activities.length === 0) {
      bulletSummary += "- No activities found.\n";
    } else {
      // Limit to 30 elements to protect rate limits
      for (const act of activities.slice(0, 30)) {
        const dateStr = act.start_date || act.created_at || act.date || act.updated_at;
        const dateFormatted = dateStr ? new Date(dateStr).toLocaleDateString() : "N/A";
        
        const formatter = FORMATTERS[source] || defaultFormatter;
        bulletSummary += formatter(act, dateFormatted) + "\n";
      }
      if (activities.length > 30) {
        bulletSummary += `- ... and ${activities.length - 30} more entries.\n`;
      }
    }
    bulletSummary += "\n";
  }

  const rawData = bulletSummary;

  // 2. Generate Report via LLM
  const prompt = WEEKLY_REPORT_PROMPT.replace("of Rohit", `of ${name}`).replace("{{data}}", rawData);
  const llm = getLLMProvider();

  log.info("Calling LLM to synthesize report...");
  const response = await llm.chat([{ role: "user", content: prompt }]);

  const reportMarkdown = response.content;

  // 3. Save Report
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const reportsDir = REPORTS_DIR;

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, `${today}.md`);
  fs.writeFileSync(reportPath, reportMarkdown, "utf-8");

  logger.log("Report /output");

  return reportMarkdown;
}

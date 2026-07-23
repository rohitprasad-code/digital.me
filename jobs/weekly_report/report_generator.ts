import fs from "fs";
import path from "path";
import { WEEKLY_REPORT_PROMPT } from "../../model/prompts/weekly_report";
import { getLLMProvider } from "../../model/providers/provider";
import { log } from "../../utils/logger";
import { REPORTS_DIR } from "../../utils/paths";
import { VectorStore } from "../../memory/vector_store";

export async function generateWeeklyReport(): Promise<string> {
  log.info("Generating weekly report...");

  // 1. Collect Data from Vector Store (previously saved from MCP sync)
  const vectorStore = new VectorStore();
  const mcpData: Record<string, any> = {};

  try {
    await vectorStore.load();
    const allDocs = await vectorStore.getAllDocuments();

    // Collect and group all MCP documents
    const mcpDocs = allDocs.filter(
      (d) =>
        typeof d.metadata?.source === "string" &&
        d.metadata.source.startsWith("mcp:"),
    );

    for (const doc of mcpDocs) {
      const parts = doc.metadata.source.split(":");
      const sourceName = parts[1]; // e.g. "github" or "strava"
      
      if (!mcpData[sourceName]) {
        mcpData[sourceName] = { activities: [] };
      }

      try {
        const rawContent = (doc.metadata?.rawData as string) || doc.content;
        const parsed = JSON.parse(rawContent);

        if (parsed && typeof parsed === "object") {
          if (Array.isArray(parsed)) {
            mcpData[sourceName].activities = [...mcpData[sourceName].activities, ...parsed];
          } else {
            // Merge profile/settings or lists of items
            const parsedActivities = Array.isArray(parsed.activities) ? parsed.activities : [];
            const otherFields = { ...parsed };
            delete otherFields.activities;

            mcpData[sourceName] = {
              ...mcpData[sourceName],
              ...otherFields,
              activities: [...mcpData[sourceName].activities, ...parsedActivities],
            };
          }
        }
      } catch {
        // Not JSON content, add as basic activity text
        mcpData[sourceName].activities.push({ text: doc.content });
      }
    }

    // Filter recent activities in the generic mcpData structure
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    for (const sourceName of Object.keys(mcpData)) {
      const data = mcpData[sourceName];
      if (data.activities && Array.isArray(data.activities) && data.activities.length > 0) {
        const recent = data.activities.filter((act: any) => {
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
  } catch (e) {
    // Fall back silently
  }

  const rawData = JSON.stringify(mcpData, null, 2);

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

  log.info(`Weekly report saved to ${reportPath}`);

  return reportMarkdown;
}

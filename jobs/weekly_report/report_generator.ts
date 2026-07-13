import fs from "fs";
import path from "path";
import { WEEKLY_REPORT_PROMPT } from "../../model/prompts/weekly_report";
import { getLLMProvider } from "../../model/llm/provider";
import { log } from "../../utils/logger";
import { REPORTS_DIR } from "../../utils/paths";
import { VectorStore } from "../../memory/vector_store";

export async function generateWeeklyReport(): Promise<string> {
  log.info("Generating weekly report...");

  // 1. Collect Data from Vector Store (previously saved from MCP sync)
  const vectorStore = new VectorStore();
  let githubData = null;
  let stravaData = null;

  try {
    await vectorStore.load();
    const allDocs = await vectorStore.getAllDocuments();

    // Process GitHub data
    const githubDocs = allDocs.filter(
      (d) =>
        typeof d.metadata?.source === "string" &&
        d.metadata.source.startsWith("mcp:github"),
    );
    let githubMerged: Record<string, unknown> & { activities?: unknown[] } = {};
    for (const doc of githubDocs) {
      try {
        const parsed = JSON.parse(doc.content);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          githubMerged = { ...githubMerged, ...(parsed as Record<string, unknown>) };
        }
      } catch {
        // Not JSON content, skip or log
      }
    }
    if (Object.keys(githubMerged).length > 0) {
      if (githubMerged.activities && Array.isArray(githubMerged.activities)) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentActivity = (githubMerged.activities as Array<{ created_at: string }>).filter(
          (event: { created_at: string }) => new Date(event.created_at) >= sevenDaysAgo,
        );
        githubData = { recentActivities: recentActivity.length, ...githubMerged };
      } else {
        githubData = githubMerged;
      }
    }

    // Process Strava data
    const stravaDocs = allDocs.filter(
      (d) =>
        typeof d.metadata?.source === "string" &&
        d.metadata.source.startsWith("mcp:strava"),
    );
    let stravaMerged: Record<string, unknown> & { activities?: unknown[] } = {};
    for (const doc of stravaDocs) {
      try {
        const parsed = JSON.parse(doc.content);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          stravaMerged = { ...stravaMerged, ...(parsed as Record<string, unknown>) };
        }
      } catch {
        // Not JSON content, skip or log
      }
    }
    if (Object.keys(stravaMerged).length > 0) {
      if (stravaMerged.activities && Array.isArray(stravaMerged.activities)) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentActivities = (stravaMerged.activities as Array<{ start_date: string }>).filter(
          (a: { start_date: string }) => new Date(a.start_date) >= sevenDaysAgo,
        );
        stravaData = {
          recentActivitiesCount: recentActivities.length,
          ...stravaMerged,
        };
      } else {
        stravaData = stravaMerged;
      }
    }
  } catch (error) {
    log.error(
      "Failed to read data from Vector Store:",
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  const rawData = JSON.stringify(
    {
      github: githubData,
      strava: stravaData,
    },
    null,
    2,
  );

  // 2. Generate Report via LLM
  const prompt = WEEKLY_REPORT_PROMPT.replace("{{data}}", rawData);
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

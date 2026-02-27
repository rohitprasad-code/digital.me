import fs from "fs";
import path from "path";
import { WEEKLY_REPORT_PROMPT } from "../../model/prompts/weekly_report";
import { getLLMProvider } from "../../model/llm/provider";
import { log } from "../../utils/logger";

export async function generateWeeklyReport(): Promise<string> {
  log.info("Generating weekly report...");

  // 1. Collect Data Inline from Local Memory Storage
  const dynamicMemoryDir = path.resolve(
    process.cwd(),
    "memory/memory_type/dynamic",
  );
  let githubData = null;
  let stravaData = null;

  try {
    const githubPath = path.join(dynamicMemoryDir, "github.json");
    if (fs.existsSync(githubPath)) {
      const content = fs.readFileSync(githubPath, "utf-8");
      const parsed = JSON.parse(content);

      if (parsed.activities && Array.isArray(parsed.activities)) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentActivity = parsed.activities.filter(
          (event: any) => new Date(event.created_at) >= sevenDaysAgo,
        );
        githubData = { recentActivities: recentActivity.length, ...parsed };
      }
    }
  } catch (error) {
    log.warn(
      "Failed to read local GitHub data:",
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  try {
    const stravaPath = path.join(dynamicMemoryDir, "strava.json");
    if (fs.existsSync(stravaPath)) {
      const content = fs.readFileSync(stravaPath, "utf-8");
      const parsed = JSON.parse(content);

      if (parsed.activities && Array.isArray(parsed.activities)) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentActivities = parsed.activities.filter(
          (a: any) => new Date(a.start_date) >= sevenDaysAgo,
        );
        stravaData = {
          recentActivitiesCount: recentActivities.length,
          ...parsed,
        };
      }
    }
  } catch (error) {
    log.warn(
      "Failed to read local Strava data:",
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
  const reportsDir = path.join(process.cwd(), "data", "reports");

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, `${today}.md`);
  fs.writeFileSync(reportPath, reportMarkdown, "utf-8");

  log.info(`Weekly report saved to ${reportPath}`);

  return reportMarkdown;
}

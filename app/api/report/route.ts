import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { generateWeeklyReport } from "../../../jobs/weekly_report";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const dateStr = searchParams.get("date"); // YYYY-MM-DD

  const reportsDir = path.join(process.cwd(), "data", "reports");

  if (!fs.existsSync(reportsDir)) {
    return NextResponse.json({ error: "No reports found." }, { status: 404 });
  }

  if (dateStr) {
    const reportPath = path.join(reportsDir, `${dateStr}.md`);
    if (fs.existsSync(reportPath)) {
      const content = fs.readFileSync(reportPath, "utf-8");
      return NextResponse.json({ content });
    } else {
      return NextResponse.json(
        { error: "Report not found for given date." },
        { status: 404 },
      );
    }
  }

  // Find latest
  const files = fs
    .readdirSync(reportsDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse();

  if (files.length === 0) {
    return NextResponse.json({ error: "No reports found." }, { status: 404 });
  }

  const latestFile = path.join(reportsDir, files[0]);
  const content = fs.readFileSync(latestFile, "utf-8");

  return NextResponse.json({ content });
}

export async function POST() {
  try {
    const reportMarkdown = await generateWeeklyReport();
    return NextResponse.json({ content: reportMarkdown });
  } catch (error) {
    console.error("Failed to generate report:", error);
    return NextResponse.json(
      { error: "Failed to generate report." },
      { status: 500 },
    );
  }
}

#!/usr/bin/env node
import { Command } from "commander";
import { loadEnvConfig } from "@next/env";
import { startChat } from "./chat";
import { ingest } from "../memory/ingest";
import { log } from "../utils/logger";
import { generateWeeklyReport } from "../jobs/weekly_report";
import fs from "fs";
import path from "path";

// Load environment variables from .env* files
loadEnvConfig(process.cwd());

const program = new Command();

program.name("digital-me").description("CLI for Digital Me").version("0.1.0");

program
  .command("chat")
  .description("Start a chat session with Digital Me")
  .option("-u, --url <url>", "API URL to connect to")
  .action((options) => {
    const apiUrl = options.url || process.env.DIGITAL_ME_API_URL;
    startChat(apiUrl);
  });

program
  .command("ingest")
  .description("Ingest data from all sources (including GitHub)")
  .action(async () => {
    try {
      await ingest();
    } catch (error) {
      log.error(
        "Ingestion failed",
        error instanceof Error ? error.message : "Unknown error",
      );
      process.exit(1);
    }
  });

program
  .command("report")
  .description("Generate your automated weekly report")
  .action(async () => {
    try {
      const report = await generateWeeklyReport();
      log.info("Report generation successful.\n");
      console.log(report);
    } catch (error) {
      log.error(
        "Report generation failed",
        error instanceof Error ? error.message : "Unknown error",
      );
      process.exit(1);
    }
  });

program
  .command("report:list")
  .description("List previously generated reports")
  .action(() => {
    const reportsDir = path.join(process.cwd(), "data", "reports");
    if (!fs.existsSync(reportsDir)) {
      log.info("No reports have been generated yet.");
      return;
    }
    const files = fs
      .readdirSync(reportsDir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();
    if (files.length === 0) {
      log.info("No reports have been generated yet.");
      return;
    }
    log.info("Available reports:");
    files.forEach((f) => console.log(`- ${f.replace(".md", "")}`));
  });

program.parse(process.argv);

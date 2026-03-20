#!/usr/bin/env node
import { Command } from "commander";
import { loadEnvConfig } from "@next/env";
import { startChat } from "./chat";
import { ingest } from "../memory/ingest";
import { log } from "../utils/logger";
import { generateWeeklyReport } from "../jobs/weekly_report";
import fs from "fs";
import path from "path";
import { StravaClient } from "../integrations/strava/client";
import { ensureValidToken as ensureStravaToken, getTokenStatus as getStravaStatus } from "../integrations/strava/auth";
import { LinkedInClient } from "../integrations/linkedin/client";
import { ensureValidToken as ensureLinkedInToken, getTokenStatus as getLinkedInStatus } from "../integrations/linkedin/auth";

// Load environment variables from .env* files
loadEnvConfig(process.cwd());

const program = new Command();

program.name("digital-me").description("CLI for Digital Me").version("0.1.0");

program
  .command("chat")
  .description("Start a chat session with Digital Me")
  .option("-u, --url <url>", "API URL to connect to")
  .option(
    "-m, --mode <mode>",
    "Context mode: recruiter, social, or default (auto-detect if omitted)",
  )
  .action((options) => {
    const apiUrl = options.url || process.env.DIGITAL_ME_API_URL;
    startChat(apiUrl, options.mode);
  });

program
  .command("sync")
  .alias("ingest")
  .description("Incrementally sync and embed new/changed data from all sources")
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
      .filter((f: string) => f.endsWith(".md"))
      .sort()
      .reverse();
    if (files.length === 0) {
      log.info("No reports have been generated yet.");
      return;
    }
    log.info("Available reports:");
    files.forEach((f: string) => console.log(`- ${f.replace(".md", "")}`));
  });

program
  .command("strava:auth")
  .description("Authenticate with Strava and update tokens")
  .action(async () => {
    try {
      console.log("\n--- Strava OAuth ---\n");
      await ensureStravaToken();
    } catch (error) {
      log.error(
        "Strava authentication failed",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

program
  .command("strava:status")
  .description("Check Strava token health without making an API call")
  .action(() => {
    console.log("\n--- Strava Token Status ---\n");
    const { status, expiresAt } = getStravaStatus();
    switch (status) {
      case "valid":
        log.success(
          `✓ Token is valid. Expires at ${expiresAt!.toLocaleString()}`,
        );
        break;
      case "expired":
        log.warn(
          `⟳ Token is expired (was valid until ${expiresAt!.toLocaleString()}). Run \`npm run cli strava:auth\` to refresh.`,
        );
        break;
      case "missing":
        log.warn(
          "⚠ No Strava tokens found. Run `npm run cli strava:auth` to authorize.",
        );
        break;
      case "unknown":
        log.warn(
          "⚠ Tokens exist but expiration is unknown. Run `npm run cli strava:auth` to refresh.",
        );
        break;
    }
    console.log();
  });

program
  .command("strava:test")
  .description("Test Strava API connection by fetching profile")
  .action(async () => {
    try {
      const client = new StravaClient();
      log.info("Fetching Strava profile...");
      const profile = await client.getProfile();

      if (profile) {
        log.success("Strava connection verified!");
        console.log(JSON.stringify(profile, null, 2));
      } else {
        log.error("Failed to fetch profile (returned null)");
      }
    } catch (error) {
      log.error(
        "Strava test failed",
        error instanceof Error ? error.message : String(error),
      );
    }
  });

program
  .command("linkedin:auth")
  .description("Authenticate with LinkedIn and update tokens")
  .action(async () => {
    try {
      console.log("\n--- LinkedIn OAuth ---\n");
      await ensureLinkedInToken();
    } catch (error) {
      log.error(
        "LinkedIn authentication failed",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

program
  .command("linkedin:status")
  .description("Check LinkedIn token health")
  .action(() => {
    console.log("\n--- LinkedIn Token Status ---\n");
    const { status } = getLinkedInStatus();
    switch (status) {
      case "valid":
        log.success("✓ Token is valid.");
        break;
      case "missing":
        log.warn(
          "⚠ No LinkedIn tokens found. Run `npm run cli linkedin:auth` to authorize.",
        );
        break;
    }
    console.log();
  });

program
  .command("linkedin:test")
  .description("Test LinkedIn API connection by fetching profile")
  .action(async () => {
    try {
      const accessToken = await ensureLinkedInToken();
      const client = new LinkedInClient(accessToken);
      log.info("Fetching LinkedIn profile...");
      const profile = await client.getProfile();

      if (profile) {
        log.success("LinkedIn connection verified!");
        console.log(JSON.stringify(profile, null, 2));
      } else {
        log.error("Failed to fetch profile (returned null)");
      }
    } catch (error) {
      log.error(
        "LinkedIn test failed",
        error instanceof Error ? error.message : String(error),
      );
    }
  });

program.parseAsync(process.argv);

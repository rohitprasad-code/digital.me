#!/usr/bin/env node
import { Command } from "commander";
import { loadEnvConfig } from "@next/env";
import { startChat } from "./chat";
import { ingest } from "../memory/ingest";
import { log } from "../utils/logger";
import { generateWeeklyReport } from "../jobs/weekly_report";
import fs from "fs";
import path from "path";
import readline from "readline";
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
} from "../integrations/strava/auth";
import { StravaClient } from "../integrations/strava/client";

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
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    const redirectUri = "http://localhost:7001";

    if (!clientId || !clientSecret) {
      log.error(
        "STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set in .env.local",
      );
      process.exit(1);
    }

    const authUrl = getAuthorizationUrl(
      clientId,
      redirectUri,
      "read,activity:read,activity:read_all",
    );

    console.log("\n--- Strava OAuth Helper ---\n");
    console.log("1. Open this URL in your browser to authorize:");
    console.log(authUrl);
    console.log(
      "\n2. After authorizing, you will be redirected to a URL that looks like:",
    );
    console.log(
      `${redirectUri}/?state=&code=YOUR_AUTHORIZATION_CODE&scope=...`,
    );
    console.log("\n3. Copy the 'code' value and paste it here:");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("Enter authorization code: ", async (code) => {
      try {
        log.info("Exchanging code for tokens...");
        const tokens = await exchangeCodeForTokens(
          clientId,
          clientSecret,
          code.trim(),
        );

        console.log("\n--- TOKENS RECEIVED ---");
        console.log(`Access Token:  ${tokens.access_token}`);
        console.log(`Refresh Token: ${tokens.refresh_token}`);
        console.log(
          `Expires At:    ${new Date(tokens.expires_at * 1000).toLocaleString()}`,
        );
        console.log("------------------------\n");

        log.info("Please update your .env.local file with these values.");
      } catch (error) {
        log.error(
          "Error exchanging code",
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        rl.close();
      }
    });
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

program.parse(process.argv);

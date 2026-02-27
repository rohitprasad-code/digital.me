import cron from "node-cron";
import { exec } from "child_process";
import { log } from "../utils/logger";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

log.info("Starting up cron scheduler...");

// Job 1: Trigger `npm run cli ingest` every day at 11 PM
cron.schedule("0 23 * * *", () => {
  log.info("Cron job triggered: Ingesting data...");

  exec(
    "npm run cli:exec ingest",
    { cwd: process.cwd() },
    (error, stdout, stderr) => {
      if (error) {
        log.error("Cron ingest job failed", error.message);
        return;
      }
      if (stderr && !stderr.includes("debugger")) {
        log.error("Cron ingest job stderr", stderr);
      }
      log.info("Cron ingest job completed successfully.");
      if (stdout) {
        console.log(stdout);
      }
    },
  );
});

// Job 2: Trigger `npm run cli report` every Sunday at 11:50 PM
cron.schedule("50 23 * * 0", () => {
  log.info("Cron job triggered: Generating weekly report...");

  exec(
    "npm run cli:exec report",
    { cwd: process.cwd() },
    (error, stdout, stderr) => {
      if (error) {
        log.error("Cron report job failed", error.message);
        return;
      }
      if (stderr && !stderr.includes("debugger")) {
        log.error("Cron report job stderr", stderr);
      }
      log.info("Cron report job completed successfully.");
      if (stdout) {
        console.log(stdout);
      }
    },
  );
});

log.info("Scheduler is running. Waiting for jobs...");

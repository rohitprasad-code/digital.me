import fs from "fs/promises";
import path from "path";

export type LogLevel = "ERROR" | "WARN" | "INFO" | "SUCCESS";

export async function logEvent(
  level: LogLevel = "INFO",
  message: string,
  metadata: any = {},
) {
  try {
    console.log(message);
    const logsDir = path.resolve(process.cwd(), ".logs");
    await fs.mkdir(logsDir, { recursive: true });

    const logFile = path.join(logsDir, `logger.log`);
    const timestamp = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .format(new Date())
      .replace(", ", " ");

    let logLine = `[${timestamp} IST] [${level}]\t${message}`;
    if (metadata && Object.keys(metadata).length > 0) {
      logLine += ` | Meta: ${JSON.stringify(metadata)}`;
    }
    logLine += "\n";

    await fs.appendFile(logFile, logLine);
  } catch (error) {
    console.error(`Failed to write to logger.log:`, error);
  }
}

export const log = {
  info: (message: string, metadata: any = {}) =>
    logEvent("INFO", message, metadata),
  error: (message: string, metadata: any = {}) =>
    logEvent("ERROR", message, metadata),
  warn: (message: string, metadata: any = {}) =>
    logEvent("WARN", message, metadata),
  success: (message: string, metadata: any = {}) =>
    logEvent("SUCCESS", message, metadata),
};

import fs from "fs/promises";
import path from "path";

export type LogLevel = "ERROR" | "WARN" | "INFO" | "SUCCESS";

// Intercept stdout to strip leading spaces from Next.js HTTP request logs (e.g. " GET /" -> "GET /")
if (typeof process !== "undefined" && process.stdout) {
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);

  process.stdout.write = (
    chunk: string | Buffer,
    encoding?: BufferEncoding | ((err?: Error | null) => void),
    callback?: (err?: Error | null) => void
  ): boolean => {
    const str = typeof chunk === "string" ? chunk : chunk.toString("utf-8");
    const cleaned = str.replace(/^\s+(GET|POST|PUT|DELETE|PATCH)\b/gm, "$1");
    if (typeof encoding === "function") {
      return originalStdoutWrite(cleaned, encoding);
    }
    return originalStdoutWrite(cleaned, encoding as BufferEncoding, callback);
  };
}

async function logToFile(
  level: LogLevel = "INFO",
  message: string,
  metadata: unknown = {},
) {
  try {
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
    if (metadata && typeof metadata === "object" && Object.keys(metadata).length > 0) {
      logLine += ` | Meta: ${JSON.stringify(metadata)}`;
    } else if (metadata && typeof metadata !== "object") {
      logLine += ` | Meta: ${metadata}`;
    }
    logLine += "\n";

    await fs.appendFile(logFile, logLine);
  } catch (error) {
    console.error(`Failed to write to logger.log:`, error);
  }
}

export const logger = {
  log: (message: string, ...args: unknown[]) => {
    console.log(message, ...args);
  },
  info: (message: string, metadata: unknown = {}) => {
    console.log(message);
    logToFile("INFO", message, metadata).catch(() => {});
  },
  warn: (message: string, metadata: unknown = {}) => {
    console.warn(message);
    logToFile("WARN", message, metadata).catch(() => {});
  },
  error: (message: string, metadata: unknown = {}) => {
    console.error(message);
    logToFile("ERROR", message, metadata).catch(() => {});
  },
  success: (message: string, metadata: unknown = {}) => {
    console.log(message);
    logToFile("SUCCESS", message, metadata).catch(() => {});
  }
};

export const log = logger;

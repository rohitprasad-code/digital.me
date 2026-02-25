import fs from "fs/promises";
import path from "path";

type LogCategory = "ingest";

export async function logEvent(
  category: LogCategory,
  message: string,
  metadata?: any,
) {
  try {
    const logsDir = path.resolve(process.cwd(), ".logs");
    await fs.mkdir(logsDir, { recursive: true });

    const logFile = path.join(logsDir, `${category}.log`);
    const timestamp = new Date().toISOString();

    let logLine = `[${timestamp}] ${message}`;
    if (metadata) {
      logLine += ` | Meta: ${JSON.stringify(metadata)}`;
    }
    logLine += "\n";

    await fs.appendFile(logFile, logLine);
  } catch (error) {
    console.error(`Failed to write to ${category}.log:`, error);
  }
}

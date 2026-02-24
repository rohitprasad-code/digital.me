import fs from "fs/promises";
import path from "path";

export async function crawlDirectory(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;

      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await crawlDirectory(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error crawling directory ${dirPath}:`, err);
  }
  return files;
}

export type FileRole =
  | "structured"
  | "unstructured"
  | "code"
  | "pdf"
  | "unknown";

export function determineFileRole(filePath: string): FileRole {
  const ext = path.extname(filePath).toLowerCase();

  if ([".pdf"].includes(ext)) return "pdf";
  if ([".json", ".csv"].includes(ext)) return "structured";
  if ([".ts", ".html"].includes(ext)) return "code";
  if ([".md", ".txt"].includes(ext)) return "unstructured";

  return "unknown";
}

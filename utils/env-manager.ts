import fs from "fs/promises";
import path from "path";

export async function updateEnvFile(
  envPath: string,
  updates: Record<string, string | number>,
) {
  let content = "";
  try {
    content = await fs.readFile(envPath, "utf-8");
  } catch (error) {
    // If file doesn't exist, we'll create it
    if ((error as any).code !== "ENOENT") {
      throw error;
    }
  }

  const lines = content.split("\n");
  const updatedKeys = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "" || line.startsWith("#")) continue;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      if (updates[key] !== undefined) {
        lines[i] = `${key}=${updates[key]}`;
        updatedKeys.add(key);
      }
    }
  }

  // Add keys that weren't found in the file
  for (const [key, value] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) {
      lines.push(`${key}=${value}`);
    }
  }

  // Ensure file ends with a newline
  let finalContent = lines.join("\n");
  if (!finalContent.endsWith("\n")) {
    finalContent += "\n";
  }

  await fs.writeFile(envPath, finalContent, "utf-8");
}

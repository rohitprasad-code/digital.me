import { log } from "../../utils/logger";

interface GitHubRepo {
  name?: string;
  description?: string;
  language?: string;
  stargazers_count?: number;
  forks_count?: number;
  html_url?: string;
  updated_at?: string;
}

interface StravaActivity {
  name?: string;
  type?: string;
  distance?: number; // in meters
  moving_time?: number; // in seconds
  average_heartrate?: number;
  max_heartrate?: number;
  start_date?: string;
}

function renderTemplate(template: string, item: any): string {
  return template.replace(/\{([^}]+)\}/g, (match, expression) => {
    const [expr, formatter] = expression.split(":");
    const keys = expr.trim().split(".");
    let value = item;
    for (const key of keys) {
      if (value && typeof value === "object") {
        value = value[key];
      } else {
        value = undefined;
        break;
      }
    }

    if (value === undefined || value === null) {
      return "";
    }

    if (formatter === "km") {
      return `${(Number(value) / 1000).toFixed(2)} km`;
    }
    if (formatter === "min") {
      return `${Math.round(Number(value) / 60)} minutes`;
    }
    if (formatter === "date") {
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return String(value);
      }
    }

    return String(value);
  });
}

export function transformMcpDataToNarrative(
  content: any,
  serverName: string,
  toolName: string,
  config?: { itemTemplate?: string; narrativeTemplate?: string }
): { contentText: string; rawData: string } {
  const rawData = typeof content === "string" ? content : JSON.stringify(content);
  let parsed: any = content;

  if (typeof content === "string") {
    try {
      parsed = JSON.parse(content);
    } catch {
      // Not JSON content, return as is
      return { contentText: content, rawData };
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return { contentText: String(content), rawData };
  }

  // Schema-driven dynamic template formatting
  if (config) {
    if (config.itemTemplate) {
      const items = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.items)
        ? parsed.items
        : Array.isArray(parsed.repositories)
        ? parsed.repositories
        : Array.isArray(parsed.activities)
        ? parsed.activities
        : null;

      if (items && items.length > 0) {
        const narrativeLines = items.map((item) => renderTemplate(config.itemTemplate!, item));
        return {
          contentText: `${serverName.toUpperCase()} Data:\n${narrativeLines.join("\n")}`,
          rawData,
        };
      }
    }

    if (config.narrativeTemplate) {
      return {
        contentText: renderTemplate(config.narrativeTemplate, parsed),
        rawData,
      };
    }
  }

  // Fallback: Hardcoded mappings for GitHub Repositories
  if (serverName === "github" && (toolName === "list_repositories" || toolName === "get_repositories")) {
    const repos: GitHubRepo[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.repositories)
      ? parsed.repositories
      : [];

    if (repos.length > 0) {
      const narrativeLines = repos.map((repo) => {
        const desc = repo.description ? `described as "${repo.description}"` : "with no description";
        const lang = repo.language ? `, primarily written in ${repo.language}` : "";
        const stars = repo.stargazers_count ? `, having ${repo.stargazers_count} stars` : "";
        const updated = repo.updated_at ? ` (last updated on ${new Date(repo.updated_at).toLocaleDateString()})` : "";
        return `I have a GitHub repository named "${repo.name}" ${desc}${lang}${stars}${updated}. Link: ${repo.html_url || "N/A"}.`;
      });
      return {
        contentText: `GitHub Repositories:\n${narrativeLines.join("\n")}`,
        rawData,
      };
    }
  }

  // Fallback: Hardcoded mappings for Strava Activities
  if (serverName === "strava" && (toolName === "get_activities" || toolName === "get_recent_activities" || toolName === "get_recent_activities_all")) {
    const activities: StravaActivity[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.activities)
      ? parsed.activities
      : [];

    if (activities.length > 0) {
      const narrativeLines = activities.map((act) => {
        const name = act.name ? `named "${act.name}"` : "activity";
        const type = act.type || "Workout";
        const distKm = act.distance ? `${(act.distance / 1000).toFixed(2)} km` : "unknown distance";
        const mins = act.moving_time ? `${Math.round(act.moving_time / 60)} minutes` : "unknown duration";
        const hr = act.average_heartrate ? `, with an average heart rate of ${Math.round(act.average_heartrate)} bpm` : "";
        const date = act.start_date ? ` on ${new Date(act.start_date).toLocaleDateString()}` : "";
        return `I completed a Strava ${type} ${name} covering ${distKm} in ${mins}${hr}${date}.`;
      });
      return {
        contentText: `Strava Activities:\n${narrativeLines.join("\n")}`,
        rawData,
      };
    }
  }

  // Fallback default formatting for other tools/servers
  return { contentText: rawData, rawData };
}

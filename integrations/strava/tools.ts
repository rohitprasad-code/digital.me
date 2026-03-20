/**
 * Strava Tool Functions
 *
 * Live API functions the LLM can invoke to fetch fresh data from Strava.
 * These bypass the vector store and hit the Strava API directly.
 */

import { ToolDefinition } from "../../model/tools/types";
import { StravaClient } from "./client";

const strava = new StravaClient();

/**
 * Fetches recent Strava activities live from the API.
 */
async function getStravaActivities(args: Record<string, unknown>) {
  const limit = (args.limit as number) || 5;
  const activities = await strava.getRecentActivities(limit);

  return activities.map((a) => ({
    name: a.name,
    type: a.type,
    sport_type: a.sport_type,
    date: a.start_date_local,
    distance_km: (a.distance / 1000).toFixed(2),
    moving_time_min: Math.floor(a.moving_time / 60),
    elevation_gain_m: a.total_elevation_gain,
    avg_speed_kmh: (a.average_speed * 3.6).toFixed(2),
    location: [a.location_city, a.location_state, a.location_country]
      .filter(Boolean)
      .join(", "),
  }));
}

/**
 * Fetches the live Strava athlete profile.
 */
async function getStravaProfile() {
  const profile = await strava.getProfile();
  if (!profile) {
    return { error: "Could not fetch Strava profile. Token may be invalid." };
  }
  return {
    name: `${profile.firstname} ${profile.lastname}`,
    username: profile.username,
    location: [profile.city, profile.state, profile.country]
      .filter(Boolean)
      .join(", "),
    bio: profile.bio,
    followers: profile.follower_count,
    following: profile.friend_count,
  };
}

// ── Tool Definitions ────────────────────────────────────────────────

export const stravaTools: ToolDefinition[] = [
  {
    name: "get_strava_activities",
    description:
      "Fetches recent Strava activities (runs, rides, hikes, etc.) live from the Strava API. Use when the user asks about recent workouts, runs, rides, exercises, or fitness data.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description:
            "Number of recent activities to fetch. Defaults to 5, max 30.",
        },
      },
    },
    execute: getStravaActivities,
  },
  {
    name: "get_strava_profile",
    description:
      "Fetches the live Strava athlete profile. Use when the user asks about Strava profile, athletic stats, or follower count from Strava specifically.",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: getStravaProfile,
  },
];

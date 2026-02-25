import fs from "fs/promises";
import path from "path";
import { logEvent } from "../../utils/logger";
import { StravaClient } from "./client";
import { VectorStore } from "../../memory/vector_store";

export async function ingestStrava(vectorStore: VectorStore) {
  console.log("Ingesting Strava data...");
  try {
    const strava = new StravaClient();
    const stravaData: any = {};

    // 1. Profile
    const profile = await strava.getProfile();
    if (profile) {
      stravaData.profile = profile;
      let profileContent = `Strava Profile: ${profile.firstname} ${profile.lastname}`;
      if (profile.username) profileContent += ` (@${profile.username})`;
      profileContent += `\nLocation: ${profile.city}, ${profile.state}, ${profile.country}`;
      if (profile.bio) profileContent += `\nBio: ${profile.bio}`;
      profileContent += `\nStats: ${profile.follower_count} followers, ${profile.friend_count} following`;

      await vectorStore.addDocument(profileContent, {
        source: "strava",
        type: "strava_profile",
      });
    }

    // 2. Activities
    const activities = await strava.getRecentActivities(20);
    if (activities && activities.length > 0) {
      stravaData.activities = activities;
      for (const activity of activities) {
        // Distance in meters to km/miles
        const distanceKm = (activity.distance / 1000).toFixed(2);
        // Time in seconds to minutes
        const minutes = Math.floor(activity.moving_time / 60);
        const seconds = activity.moving_time % 60;
        const timeFormatted = `${minutes}m ${seconds}s`;

        // Speed in m/s to km/h
        const speedKmH = (activity.average_speed * 3.6).toFixed(2);

        const content = `Strava Activity: ${activity.name}\nType: ${activity.type} (${activity.sport_type})\nDate: ${activity.start_date_local}\nLocation: ${activity.location_city}, ${activity.location_state}, ${activity.location_country}\nDistance: ${distanceKm} km\nMoving Time: ${timeFormatted}\nElevation Gain: ${activity.total_elevation_gain} meters\nAverage Speed: ${speedKmH} km/h`;

        await vectorStore.addDocument(content, {
          source: "strava",
          type: "strava_activity",
          name: activity.name,
          activity_type: activity.type,
          start_date: activity.start_date_local,
        });
      }
    }

    // Save Strava data to JSON file
    const stravaJsonPath = path.resolve(
      process.cwd(),
      "memory/memory_type/dynamic/strava.json",
    );
    await fs.mkdir(path.dirname(stravaJsonPath), { recursive: true });
    await fs.writeFile(stravaJsonPath, JSON.stringify(stravaData, null, 2));
    console.log(`Saved Strava data to ${stravaJsonPath}`);

    console.log("Successfully ingested Strava data.");
    await logEvent("ingest", "Successfully ingested Strava data");
  } catch (error) {
    console.warn(
      "Skipping Strava ingestion:",
      error instanceof Error ? error.message : "Unknown error",
    );
    await logEvent("ingest", "Skipping Strava ingestion", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

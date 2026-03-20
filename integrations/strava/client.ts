import { ensureValidToken, forceRefresh } from "./auth";

export class StravaClient {
  private accessToken: string | null = null;
  private baseUrl = "https://www.strava.com/api/v3";

  constructor() {}

  private async getToken(): Promise<string> {
    if (!this.accessToken) {
      this.accessToken = await ensureValidToken();
    }
    return this.accessToken;
  }

  private async fetchStrava(endpoint: string, isRetry = false): Promise<unknown> {
    const token = await this.getToken();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Auto-retry once on 401 by forcing a token refresh
    if (response.status === 401 && !isRetry) {
      this.accessToken = await forceRefresh();
      return this.fetchStrava(endpoint, true);
    }

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorData = await response.json();
        errorMessage = JSON.stringify(errorData);
      } catch {}
      throw new Error(`Strava API Error: ${response.status} - ${errorMessage}`);
    }

    return await response.json();
  }

  async getProfile() {
    try {
      const data = await this.fetchStrava("/athlete") as Record<string, unknown>;
      return {
        id: data.id as number,
        username: data.username as string,
        firstname: data.firstname as string,
        lastname: data.lastname as string,
        bio: data.bio as string,
        city: data.city as string,
        state: data.state as string,
        country: data.country as string,
        sex: data.sex as string,
        profile: data.profile as string,
        follower_count: data.follower_count as number,
        friend_count: data.friend_count as number,
      };
    } catch (error) {
      console.error("Error fetching Strava profile:", error);
      return null;
    }
  }

  async getRecentActivities(limit: number = 10) {
    try {
      const data = await this.fetchStrava(
        `/athlete/activities?per_page=${limit}`,
      );

      return (data as Record<string, unknown>[]).map((activity) => ({
        id: activity.id as number,
        name: activity.name as string,
        distance: activity.distance as number,
        moving_time: activity.moving_time as number,
        elapsed_time: activity.elapsed_time as number,
        total_elevation_gain: activity.total_elevation_gain as number,
        type: activity.type as string,
        sport_type: activity.sport_type as string,
        start_date: activity.start_date as string,
        start_date_local: activity.start_date_local as string,
        timezone: activity.timezone as string,
        location_city: activity.location_city as string,
        location_state: activity.location_state as string,
        location_country: activity.location_country as string,
        average_speed: activity.average_speed as number,
        max_speed: activity.max_speed as number,
      }));
    } catch (error) {
      console.error("Error fetching recent Strava activities:", error);
      return [];
    }
  }
}

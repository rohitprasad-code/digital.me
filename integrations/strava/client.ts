import { ensureValidToken, forceRefresh } from "./token";

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

  private async fetchStrava(endpoint: string, isRetry = false): Promise<any> {
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
      } catch (e) {}
      throw new Error(`Strava API Error: ${response.status} - ${errorMessage}`);
    }

    return await response.json();
  }

  async getProfile() {
    try {
      const data = await this.fetchStrava("/athlete");
      return {
        id: data.id,
        username: data.username,
        firstname: data.firstname,
        lastname: data.lastname,
        bio: data.bio,
        city: data.city,
        state: data.state,
        country: data.country,
        sex: data.sex,
        profile: data.profile,
        follower_count: data.follower_count,
        friend_count: data.friend_count,
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

      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((activity: any) => ({
        id: activity.id,
        name: activity.name,
        distance: activity.distance,
        moving_time: activity.moving_time,
        elapsed_time: activity.elapsed_time,
        total_elevation_gain: activity.total_elevation_gain,
        type: activity.type,
        sport_type: activity.sport_type,
        start_date: activity.start_date,
        start_date_local: activity.start_date_local,
        timezone: activity.timezone,
        location_city: activity.location_city,
        location_state: activity.location_state,
        location_country: activity.location_country,
        average_speed: activity.average_speed,
        max_speed: activity.max_speed,
      }));
    } catch (error) {
      console.error("Error fetching recent Strava activities:", error);
      return [];
    }
  }
}

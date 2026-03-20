export interface LinkedInProfile {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture?: string;
  locale?: string;
  email?: string;
  headline?: string;
}

export interface LinkedInExperience {
  companyName: string;
  title: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export class LinkedInClient {
  private accessToken: string;

  constructor(accessToken: string) {
    if (!accessToken) {
      throw new Error("LinkedIn access token is required");
    }
    this.accessToken = accessToken;
  }

  async getProfile(): Promise<LinkedInProfile | null> {
    try {
      const response = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Error fetching LinkedIn profile:", error);
        return null;
      }

      const data = await response.json();
      return {
        sub: data.sub,
        name: data.name,
        given_name: data.given_name,
        family_name: data.family_name,
        picture: data.picture,
        locale: data.locale,
        email: data.email,
      };
    } catch (error) {
      console.error("Error fetching LinkedIn profile:", error);
      return null;
    }
  }

  // NOTE: More advanced profile data (experiences, headline) often requires 
  // specialized LinkedIn Marketing Developer Platform or Talent Solutions API 
  // access which aren't part of the basic OpenID Connect scopes.
  // We'll keep this as a roadmap item or placeholder for now.
}

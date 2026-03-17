export interface LinkedInTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

export interface LinkedInProfile {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture?: string;
  locale?: string;
  email?: string;
  headline?: string; // May need a separate API or scope
}

export interface LinkedInExperience {
  companyName: string;
  title: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface LinkedInData {
  profile?: LinkedInProfile;
  experiences?: LinkedInExperience[];
  updatedAt: string;
}

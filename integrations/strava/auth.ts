export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
}

export function getAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  scope: string = "read,activity:read,activity:read_all",
) {
  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.append("client_id", clientId);
  url.searchParams.append("redirect_uri", redirectUri);
  url.searchParams.append("response_type", "code");
  url.searchParams.append("approval_prompt", "auto");
  url.searchParams.append("scope", scope);
  return url.toString();
}

export async function exchangeCodeForTokens(
  clientId: string,
  clientSecret: string,
  code: string,
): Promise<StravaTokens> {
  const response = await fetch("https://www.strava.com/api/v3/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Failed to exchange code for tokens: ${JSON.stringify(error)}`,
    );
  }

  return await response.json();
}

export async function refreshTokens(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<StravaTokens> {
  const response = await fetch("https://www.strava.com/api/v3/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to refresh tokens: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

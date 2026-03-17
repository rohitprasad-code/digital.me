import { LinkedInTokens } from "./types";

export function getAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  scope: string = "openid profile email",
) {
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.append("response_type", "code");
  url.searchParams.append("client_id", clientId);
  url.searchParams.append("redirect_uri", redirectUri);
  url.searchParams.append("scope", scope);
  return url.toString();
}

export async function exchangeCodeForTokens(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string,
): Promise<LinkedInTokens> {
  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Failed to exchange LinkedIn code for tokens: ${JSON.stringify(error)}`,
    );
  }

  return await response.json();
}

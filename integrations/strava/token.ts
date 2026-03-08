import path from "path";
import { log } from "../../utils/logger";
import { updateEnvFile } from "../../utils/env-manager";
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshTokens,
  StravaTokens,
} from "./auth";
import { captureStravaCode, openBrowser } from "../../cli/strava-oauth-server";

const ENV_PATH = path.resolve(process.cwd(), ".env.local");

export async function ensureValidToken(): Promise<string> {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  let accessToken = process.env.STRAVA_ACCESS_TOKEN;
  let refreshToken = process.env.STRAVA_REFRESH_TOKEN;
  let expiresAt = parseInt(process.env.STRAVA_EXPIRES_AT || "0", 10);

  if (!clientId || !clientSecret) {
    throw new Error(
      "STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set in .env.local",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const oneHour = 3600;

  // 1. Initial Authorization if tokens are missing
  if (!accessToken || !refreshToken) {
    log.info("↗ Opening browser for Strava authorization...");
    const port = 8000;
    const redirectUri = `http://localhost:${port}`;
    const authUrl = getAuthorizationUrl(
      clientId,
      redirectUri,
      "read,activity:read_all,activity:write",
    );

    openBrowser(authUrl);
    const code = await captureStravaCode(port);

    log.info("Exchanging code for tokens...");
    const tokens = await exchangeCodeForTokens(clientId, clientSecret, code);
    await saveTokens(tokens);

    log.success("✓ Authorization successful. Tokens saved to .env.local");
    return tokens.access_token;
  }

  // 2. Refresh Token if expired or expiring soon (within 1 hour)
  if (expiresAt === 0 || now > expiresAt - oneHour) {
    log.info("⟳ Access token expired or expiring soon, refreshing...");
    try {
      const tokens = await refreshTokens(clientId, clientSecret, refreshToken);
      await saveTokens(tokens);
      log.success("✓ Tokens refreshed and saved to .env.local");
      return tokens.access_token;
    } catch (error) {
      log.error("Failed to refresh tokens. You may need to re-authenticate.");
      // Clear tokens to trigger re-auth on next run
      await updateEnvFile(ENV_PATH, {
        STRAVA_ACCESS_TOKEN: "",
        STRAVA_REFRESH_TOKEN: "",
        STRAVA_EXPIRES_AT: 0,
      });
      throw error;
    }
  }

  log.success("✓ Access token is valid, skipping refresh.");
  return accessToken;
}

async function saveTokens(tokens: StravaTokens) {
  // Update process.env so subsequent calls in the same process see the new values
  process.env.STRAVA_ACCESS_TOKEN = tokens.access_token;
  process.env.STRAVA_REFRESH_TOKEN = tokens.refresh_token;
  process.env.STRAVA_EXPIRES_AT = tokens.expires_at.toString();

  await updateEnvFile(ENV_PATH, {
    STRAVA_ACCESS_TOKEN: tokens.access_token,
    STRAVA_REFRESH_TOKEN: tokens.refresh_token,
    STRAVA_EXPIRES_AT: tokens.expires_at,
  });
}

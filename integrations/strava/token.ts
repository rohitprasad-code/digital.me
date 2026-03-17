import path from "path";
import { log } from "../../utils/logger";
import { updateEnvFile } from "../../utils/env-manager";
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshTokens,
  StravaTokens,
} from "./auth";
import { captureStravaCode, openBrowser } from "../../cli/oauth/strava-oauth-server";

const ENV_PATH = path.resolve(process.cwd(), ".env.local");
const REFRESH_BUFFER_SEC = 300; 

function getCredentials() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set in .env.local",
    );
  }
  return { clientId, clientSecret };
}

function isTokenExpired(): boolean {
  const expiresAt = parseInt(process.env.STRAVA_EXPIRES_AT || "0", 10);
  const now = Math.floor(Date.now() / 1000);
  return expiresAt === 0 || now > expiresAt - REFRESH_BUFFER_SEC;
}

function hasTokens(): boolean {
  return !!(
    process.env.STRAVA_ACCESS_TOKEN && process.env.STRAVA_REFRESH_TOKEN
  );
}

export async function ensureValidToken(): Promise<string> {
  const { clientId, clientSecret } = getCredentials();

  // 1. No tokens → run the full browser-based OAuth flow
  if (!hasTokens()) {
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

    log.info("  Exchanging code for tokens...");
    const tokens = await exchangeCodeForTokens(clientId, clientSecret, code);
    await saveTokens(tokens);

    log.success("✓ Authorization successful. Tokens saved to .env.local");
    return tokens.access_token;
  }

  // 2. Tokens exist but expired → silent refresh
  if (isTokenExpired()) {
    return await forceRefresh();
  }

  log.success("✓ Access token is valid, skipping refresh.");
  return process.env.STRAVA_ACCESS_TOKEN!;
}

export async function refreshTokenSilently(): Promise<string | null> {
  try {
    getCredentials();

    if (!hasTokens()) {
      log.warn(
        "⚠ No Strava tokens found. Run `npm run cli strava:auth` to authorize.",
      );
      return null;
    }

    if (!isTokenExpired()) {
      log.success("✓ Access token is valid, skipping refresh.");
      return process.env.STRAVA_ACCESS_TOKEN!;
    }

    return await forceRefresh();
  } catch (error) {
    log.error(
      "Strava token refresh failed",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

export async function forceRefresh(): Promise<string> {
  const { clientId, clientSecret } = getCredentials();
  const refreshToken = process.env.STRAVA_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error(
      "No refresh token available. Run `npm run cli strava:auth` first.",
    );
  }

  log.info("⟳ Access token expired, refreshing...");
  try {
    const tokens = await refreshTokens(clientId, clientSecret, refreshToken);
    await saveTokens(tokens);
    log.success("✓ Tokens refreshed and saved to .env.local");
    return tokens.access_token;
  } catch (error) {
    log.error(
      "  Failed to refresh. Clearing tokens to trigger re-auth on next run.",
    );
    await updateEnvFile(ENV_PATH, {
      STRAVA_ACCESS_TOKEN: "",
      STRAVA_REFRESH_TOKEN: "",
      STRAVA_EXPIRES_AT: 0,
    });
    throw error;
  }
}

export function getTokenStatus(): { status: string; expiresAt: Date | null } {
  if (!hasTokens()) {
    return { status: "missing", expiresAt: null };
  }
  const expiresAt = parseInt(process.env.STRAVA_EXPIRES_AT || "0", 10);
  if (expiresAt === 0) {
    return { status: "unknown", expiresAt: null };
  }
  const expiresDate = new Date(expiresAt * 1000);
  if (isTokenExpired()) {
    return { status: "expired", expiresAt: expiresDate };
  }
  return { status: "valid", expiresAt: expiresDate };
}

async function saveTokens(tokens: StravaTokens) {
  process.env.STRAVA_ACCESS_TOKEN = tokens.access_token;
  process.env.STRAVA_REFRESH_TOKEN = tokens.refresh_token;
  process.env.STRAVA_EXPIRES_AT = tokens.expires_at.toString();

  await updateEnvFile(ENV_PATH, {
    STRAVA_ACCESS_TOKEN: tokens.access_token,
    STRAVA_REFRESH_TOKEN: tokens.refresh_token,
    STRAVA_EXPIRES_AT: tokens.expires_at,
  });
}

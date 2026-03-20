/**
 * Strava Authentication & Token Management
 *
 * Handles the full OAuth lifecycle:
 *   - Authorization URL generation
 *   - Code → token exchange
 *   - Token refresh (automatic on 401 retry in client.ts)
 *   - Token persistence to .env.local
 */

import path from "path";
import { log } from "../../utils/logger";
import { updateEnvFile } from "../../utils/env-manager";
import { captureStravaCode, openBrowser } from "../../cli/oauth/strava-oauth-server";

// ── Types ───────────────────────────────────────────────────────────

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
}

// ── OAuth Helpers ───────────────────────────────────────────────────

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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to exchange code for tokens: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

async function refreshTokens(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<StravaTokens> {
  const response = await fetch("https://www.strava.com/api/v3/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

// ── Token Lifecycle ─────────────────────────────────────────────────

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

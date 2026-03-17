import path from "path";
import { log } from "../../utils/logger";
import { updateEnvFile } from "../../utils/env-manager";
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
} from "./auth";
import { LinkedInTokens } from "./types";
import { captureLinkedInCode, openBrowser } from "../../cli/oauth/linkedin-oauth-server";

const ENV_PATH = path.resolve(process.cwd(), ".env.local");

function getCredentials() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must be set in .env.local",
    );
  }
  return { clientId, clientSecret };
}

function hasTokens(): boolean {
  return !!process.env.LINKEDIN_ACCESS_TOKEN;
}

export async function ensureValidToken(): Promise<string> {
  const { clientId, clientSecret } = getCredentials();

  // LinkedIn tokens typically last 60 days. Refresh logic is different.
  // For now, if missing, run full flow. 
  if (!hasTokens()) {
    log.info("↗ Opening browser for LinkedIn authorization...");
    const port = 8080;
    const redirectUri = `http://localhost:${port}/callback`;
    const authUrl = getAuthorizationUrl(clientId, redirectUri);

    openBrowser(authUrl);
    const code = await captureLinkedInCode(port);

    log.info("  Exchanging code for tokens...");
    const tokens = await exchangeCodeForTokens(clientId, clientSecret, redirectUri, code);
    await saveTokens(tokens);

    log.success("✓ Authorization successful. Tokens saved to .env.local");
    return tokens.access_token;
  }

  return process.env.LINKEDIN_ACCESS_TOKEN!;
}

export function getTokenStatus(): { status: string } {
  if (!hasTokens()) {
    return { status: "missing" };
  }
  return { status: "valid" };
}

async function saveTokens(tokens: LinkedInTokens) {
  process.env.LINKEDIN_ACCESS_TOKEN = tokens.access_token;
  // Note: LinkedIn OAuth 2.0 does not always return a refresh token for basic scopes.
  
  await updateEnvFile(ENV_PATH, {
    LINKEDIN_ACCESS_TOKEN: tokens.access_token,
  });
}

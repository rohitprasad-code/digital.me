import http from "http";
import { exec } from "child_process";
import { log } from "../../utils/logger";

const CALLBACK_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

export async function captureStravaCode(port: number = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url || "", `http://localhost:${port}`);
      const code = reqUrl.searchParams.get("code");
      const error = reqUrl.searchParams.get("error");

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #18181b; color: #fafafa;">
              <h1 style="color: #ef4444;">✗ Authorization Denied</h1>
              <p style="color: #a1a1aa;">Strava returned: ${error}</p>
              <p style="color: #71717a; font-size: 0.875rem;">You can close this window.</p>
            </body>
          </html>
        `);
        cleanup();
        reject(new Error(`Strava authorization denied: ${error}`));
        return;
      }

      if (code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #18181b; color: #fafafa;">
              <h1 style="color: #10b981;">✓ Authorization Successful</h1>
              <p style="color: #a1a1aa;">You can close this window and return to the CLI.</p>
              <script>setTimeout(() => window.close(), 3000);</script>
            </body>
          </html>
        `);
        cleanup();
        resolve(code);
        return;
      }

      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #18181b; color: #fafafa;">
            <h1 style="color: #f59e0b;">⚠ Missing Code</h1>
            <p style="color: #a1a1aa;">No authorization code found in this request.</p>
          </body>
        </html>
      `);
    });

    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "OAuth callback timed out after 2 minutes. Please try again.",
        ),
      );
    }, CALLBACK_TIMEOUT_MS);

    function cleanup() {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      server.close();
    }

    server.listen(port, () => {
      log.info(
        `  Waiting for callback on http://localhost:${port} (times out in 2 min)`,
      );
    });

    server.on("error", (err) => {
      cleanup();
      reject(err);
    });
  });
}

export function openBrowser(targetUrl: string) {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  exec(`${cmd} "${targetUrl}"`);
}

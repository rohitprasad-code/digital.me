import http from "http";
import url from "url";
import { exec } from "child_process";
import { log } from "../utils/logger";

export async function captureStravaCode(port: number = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url || "", true);
      const code = parsedUrl.query.code;

      if (code && typeof code === "string") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f4f4f5;">
              <h1 style="color: #10b981;">✓ Authorization Successful</h1>
              <p style="color: #71717a;">You can close this window and return to the CLI.</p>
              <script>setTimeout(() => window.close(), 3000);</script>
            </body>
          </html>
        `);

        server.close();
        resolve(code);
      } else {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Authorization code not found in request.");
      }
    });

    server.listen(port, () => {
      log.info(`Local callback server listening on http://localhost:${port}`);
    });

    server.on("error", (err) => {
      reject(err);
    });
  });
}

export function openBrowser(url: string) {
  const start =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  exec(`${start} "${url}"`);
}

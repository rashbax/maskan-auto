// Simulate the browser CORS preflight the photo upload triggers: an OPTIONS to the R2 object
// host with Origin + Access-Control-Request-Method: PUT. If the bucket has CORS, R2 echoes
// Access-Control-Allow-Origin; if not, the header is absent and the browser blocks the PUT.
import { readFileSync } from "node:fs";
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const host = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}/apartments/_diag/probe.webp`;
for (const origin of ["http://localhost:3000", "https://maskan-24.uz"]) {
  const res = await fetch(host, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  const allow = res.headers.get("access-control-allow-origin");
  const methods = res.headers.get("access-control-allow-methods");
  console.log(`origin ${origin}: status ${res.status} | allow-origin=${allow || "(none)"} | allow-methods=${methods || "(none)"} ⇒ ${allow ? "CORS OK" : "BLOCKED"}`);
}

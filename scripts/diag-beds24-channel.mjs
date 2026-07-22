// Read-only: dump the channel/referer field Beds24 returns for recent bookings, so we can confirm
// how Airbnb reservations are tagged (source detection in lib/beds24-sync.ts reads `referer`).
// Run: node scripts/diag-beds24-channel.mjs
import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const BASE = process.env.BEDS24_API_BASE || "https://api.beds24.com/v2";
const REFRESH = process.env.BEDS24_REFRESH_TOKEN?.trim();
if (!REFRESH) { console.error("❌ BEDS24_REFRESH_TOKEN yo'q"); process.exit(1); }

const tRes = await fetch(`${BASE}/authentication/token`, { headers: { refreshToken: REFRESH } });
const { token } = await tRes.json().catch(() => ({}));
if (!token) { console.error("❌ access token olinmadi"); process.exit(1); }

const qs = new URLSearchParams({ arrivalFrom: "2026-07-01", departureTo: "2026-08-15" });
const res = await fetch(`${BASE}/bookings?${qs}`, { headers: { token } });
const j = await res.json().catch(() => ({}));
const rows = j.data || [];
console.log(`bookings in window: ${rows.length}\n`);

for (const b of rows) {
  console.log({
    id: b.id,
    referer: b.referer,
    apiSource: b.apiSource,
    channel: b.channel,
    apiReference: b.apiReference,
    reference: b.reference,
    status: b.status,
    stay: `${b.arrival}→${b.departure}`,
    name: [b.firstName, b.lastName].filter(Boolean).join(" "),
  });
}

if (rows[0]) console.log("\nALL KEYS of row[0]:\n  " + Object.keys(rows[0]).sort().join(", "));

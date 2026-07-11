// Read-only: why aren't our site's busy days showing in Beds24? Inspect apartment↔Beds24 mapping,
// which blocks/bookings pushed (beds24_booking_id set) vs didn't, and the recent outbound sync log.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
console.log("beds24 refresh token set:", !!process.env.BEDS24_REFRESH_TOKEN, "\n");

const { data: apts } = await sb.from("apartments").select("id,title,status,beds24_prop_id,beds24_room_id").order("id");
console.log("=== APARTMENTS ↔ Beds24 mapping ===");
const mapped = new Set();
for (const a of apts || []) {
  const has = a.beds24_room_id ? "MAPPED" : "—     ";
  if (a.beds24_room_id) mapped.add(a.id);
  console.log(`  ${has}  ${a.id}  prop=${a.beds24_prop_id ?? "null"} room=${a.beds24_room_id ?? "null"}  [${a.status}]  ${(a.title?.ru || a.title?.uz || "").slice(0, 38)}`);
}

const { data: blocks } = await sb.from("availability_blocks").select("apartment_id,date,beds24_booking_id");
const { data: books } = await sb.from("bookings").select("id,apartment_id,source,status,checkin,checkout,beds24_booking_id");

const tally = (rows, label) => {
  const by = {};
  for (const r of rows) {
    const k = r.apartment_id;
    (by[k] ||= { synced: 0, unsynced: 0 });
    if (r.beds24_booking_id) by[k].synced++; else by[k].unsynced++;
  }
  console.log(`\n=== ${label} (synced = pushed to Beds24) ===`);
  for (const k of Object.keys(by).sort()) {
    const t = by[k];
    const flag = !mapped.has(k) ? " ⚠ NOT MAPPED" : (t.unsynced ? " ⚠ has unsynced" : "");
    console.log(`  apt ${k}: synced=${t.synced} unsynced=${t.unsynced}${flag}`);
  }
};
tally(blocks || [], "MANUAL BLOCKS");
tally((books || []).filter((b) => ["website", "manual"].includes(b.source) && b.status === "active"), "OWNED ACTIVE BOOKINGS (website/manual)");

const { data: log } = await sb.from("beds24_sync_log").select("created_at,direction,action,ok,apartment_id,detail").eq("direction", "outbound").order("created_at", { ascending: false }).limit(15);
console.log("\n=== last 15 OUTBOUND sync-log entries ===");
for (const l of log || []) console.log(`  ${l.created_at?.slice(0, 19)} ${l.ok ? "OK  " : "FAIL"} ${l.action} apt=${l.apartment_id} ${l.ok ? "" : "→ " + (l.detail || "").slice(0, 160)}`);
if (!log?.length) console.log("  (no outbound pushes ever logged — nothing was pushed from the site)");

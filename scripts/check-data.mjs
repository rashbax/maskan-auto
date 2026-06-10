// Verifies the exact public data path the app uses (anon key + RLS + rpc).
// Run: node --env-file=.env.local scripts/check-data.mjs
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const apt = await sb.from("apartments").select("*").eq("status", "active").order("id");
const rev = await sb.from("reviews").select("*").eq("hidden", false);
if (apt.error) { console.log("❌ apartments:", apt.error.message); process.exit(1); }
console.log(`✅ apartments (anon): ${apt.data.length}`);
const a1 = apt.data[0];
console.log("   namuna a1:", { title_uz: a1.title?.uz, price: a1.price_usd, amenities: a1.amenities?.length + " ta", near_en: a1.near?.en });
console.log(`✅ reviews (anon, public): ${rev.error ? "❌ " + rev.error.message : rev.data.length}`);

const busy = await sb.rpc("busy_dates");
if (busy.error) console.log(`⚠️  busy_dates RPC: ${busy.error.message}  → 0002_busy.sql hali ishga tushmagan (bandlik bo'sh ko'rinadi)`);
else console.log(`✅ busy_dates RPC: ${busy.data.length} band kun (masalan ${busy.data.slice(0, 3).map((b) => b.apartment_id + ":" + b.d).join(", ")})`);

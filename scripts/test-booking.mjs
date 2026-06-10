// Verifies the booking insert path (anon + RLS "insert any"), then cleans up.
// Run: node --env-file=.env.local scripts/test-booking.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const id = "BK-TEST-" + Date.now().toString().slice(-6);
const ins = await anon.from("bookings").insert({
  id, apartment_id: "a1", guest_name: "Test Guest", phone: "+998900000000",
  messenger: "telegram", checkin: "2026-07-01", checkout: "2026-07-04",
  nights: 3, total_usd: 126, source: "website", status: "active",
});
console.log(ins.error ? "❌ insert (anon): " + ins.error.message : "✅ insert (anon): ok, id=" + id);

const { data } = await admin.from("bookings").select("id,apartment_id,nights,total_usd,status").eq("id", id);
console.log("   yozilgan qator:", data?.[0]);

const del = await admin.from("bookings").delete().eq("id", id);
console.log(del.error ? "cleanup err: " + del.error.message : "🧹 test qator o'chirildi");

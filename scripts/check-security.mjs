// Verifies the 0003 security hardening. Run: node --env-file=.env.local scripts/check-security.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// 1) address must no longer be selectable with the anon key (column dropped)
const addr = await anon.from("apartments").select("id,address").limit(1);
console.log(addr.error ? `✅ address yopiq: "${addr.error.message}"` : `❌ address hali o'qilyapti: ${JSON.stringify(addr.data)}`);

// 2) apartment_private exists (admin can see it)
const priv = await admin.from("apartment_private").select("*", { count: "exact", head: true });
console.log(priv.error ? `❌ apartment_private: ${priv.error.message}` : `✅ apartment_private mavjud (admin-only)`);

// 3) overlapping active booking must be rejected (a1 has BK-3120 = 06-08..06-11)
const ov = await anon.from("bookings").insert({ id: "BK-OVL-" + Date.now().toString().slice(-6), apartment_id: "a1", checkin: "2026-06-09", checkout: "2026-06-10", nights: 1, source: "website", status: "active" });
console.log(ov.error ? `✅ ustma-ust bron rad etildi: "${ov.error.message.slice(0, 70)}"` : `❌ ustma-ust bron O'TIB KETDI!`);

// 4) checkout must be > checkin
const bad = await anon.from("bookings").insert({ id: "BK-BAD-" + Date.now().toString().slice(-6), apartment_id: "a1", checkin: "2026-09-05", checkout: "2026-09-05", nights: 0, source: "website", status: "active" });
console.log(bad.error ? `✅ checkout>checkin tekshiruvi: "${bad.error.message.slice(0, 50)}"` : `❌ noto'g'ri sana o'tib ketdi`);

// 5) a normal (non-overlapping, future) booking still works
const id5 = "BK-OK-" + Date.now().toString().slice(-6);
const ok = await anon.from("bookings").insert({ id: id5, apartment_id: "a1", checkin: "2026-09-10", checkout: "2026-09-12", nights: 2, source: "website", status: "active" });
console.log(ok.error ? `❌ oddiy bron buzildi: ${ok.error.message}` : `✅ oddiy bron hali ishlaydi`);
if (!ok.error) await admin.from("bookings").delete().eq("id", id5);

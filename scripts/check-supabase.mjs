// Quick health check: are the tables + seed data in place?
// Run: node --env-file=.env.local scripts/check-supabase.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

const mask = (v) => (v ? v.slice(0, 14) + "…(" + v.length + " chars)" : "(MISSING)");
console.log("URL:        ", url || "(MISSING)");
console.log("anon key:   ", mask(anon));
console.log("service key:", mask(service));
console.log("");

if (!url || !anon) {
  console.error("❌ .env.local da NEXT_PUBLIC_SUPABASE_URL yoki ANON_KEY topilmadi.");
  process.exit(1);
}

const tables = ["apartments", "apartment_photos", "bookings", "reviews", "availability_blocks", "favorites", "profiles", "review_audit"];
const expected = { apartments: 6, reviews: 14, bookings: 5 };

const admin = service ? createClient(url, service, { auth: { persistSession: false } }) : null;
const pub = createClient(url, anon, { auth: { persistSession: false } });

console.log("=== Jadvallar (service role — RLS chetlab o'tib) ===");
if (admin) {
  for (const t of tables) {
    const { count, error } = await admin.from(t).select("*", { count: "exact", head: true });
    if (error) {
      console.log(`❌ ${t}: ${error.message}`);
    } else {
      const exp = expected[t];
      const note = exp === undefined ? "" : count === exp ? " ✓" : `  ⚠️ (kutilgan ${exp})`;
      console.log(`✅ ${t}: ${count} qator${note}`);
    }
  }
} else {
  console.log("(service key yo'q — faqat public tekshiruv)");
}

console.log("\n=== Public o'qish (anon key — ilova shu bilan ishlaydi) ===");
const { data, count, error } = await pub.from("apartments").select("id", { count: "exact" }).limit(6);
if (error) console.log("❌ apartments public read: " + error.message);
else console.log(`✅ apartments public read: ${count} qator (${data?.map((a) => a.id).join(", ")})`);

console.log("\nXulosa: apartments=6, reviews=14, bookings=5 bo'lsa — hammasi tayyor.");

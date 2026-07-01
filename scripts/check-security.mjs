// Verifies the LIVE security invariants (RLS + DB constraints) against the current model:
//   - guest bookings go through /api/book with the service role; direct anon inserts are blocked
//     (migration 0012), so overlap / date checks are exercised on the service-role path instead.
//   - the building address lives in an admin-only table (migration 0003).
// Run: node --env-file=.env.local scripts/check-security.mjs   (exits non-zero if any check fails)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let pass = 0, fail = 0;
const ok = (m) => { console.log("✅ " + m); pass++; };
const bad = (m) => { console.log("❌ " + m); fail++; };

// 1) address column is gone from the public row (moved to admin-only apartment_private in 0003)
{
  const { error } = await anon.from("apartments").select("id,address").limit(1);
  error ? ok(`address yopiq: "${error.message}"`) : bad("address hali anon key bilan o'qilyapti");
}

// 2) apartment_private is admin-only: the admin sees it, the anon key sees no rows
{
  const a = await admin.from("apartment_private").select("*", { count: "exact", head: true });
  const p = await anon.from("apartment_private").select("apartment_id").limit(1);
  if (a.error) bad(`apartment_private: admin o'qiy olmadi — ${a.error.message}`);
  else if (p.data?.length) bad("apartment_private anon key'ga ochiq!");
  else ok("apartment_private admin-only");
}

// The booking-constraint tests need a real apartment id (ids are 6-digit numbers since 0019).
const { data: apts } = await admin.from("apartments").select("id").limit(1);
const aptId = apts?.[0]?.id;

if (!aptId) {
  console.log("⚠️  bron testlari o'tkazib yuborildi — bazada apartment yo'q");
} else {
  // 3) direct anon booking insert is BLOCKED — guests must go through /api/book (0012).
  {
    const { error } = await anon.from("bookings").insert({
      id: "BK-SEC-ANON-" + Date.now().toString().slice(-6),
      apartment_id: aptId, checkin: "2099-01-10", checkout: "2099-01-12", nights: 2, source: "website", status: "active",
    });
    const rls = error?.code === "42501" || /row-level|policy/i.test(error?.message || "");
    rls ? ok(`anon to'g'ridan-to'g'ri bron qila olmaydi: "${(error.message || "").slice(0, 60)}"`)
        : bad(`anon bron O'TIB KETDI (RLS ochiq!) ${error ? error.message : ""}`);
  }

  // 4) overlap + 5) checkout>checkin hold at the DB level. Exercise them on the service-role path
  //    (the real insert path now) with far-future dates, then clean up every row we create.
  const base = "BK-SEC-" + Date.now().toString().slice(-6);
  const cleanup = [];

  const seed = base + "-A";
  const s = await admin.from("bookings").insert({ id: seed, apartment_id: aptId, checkin: "2099-03-10", checkout: "2099-03-14", nights: 4, source: "manual", status: "active" });
  if (s.error) {
    bad(`overlap testi setup buzildi — seed bron qo'shilmadi: ${s.error.message}`);
  } else {
    cleanup.push(seed);
    // 4) an overlapping ACTIVE booking must be rejected by the exclusion constraint (23P01)
    const ovId = base + "-OVL";
    const ov = await admin.from("bookings").insert({ id: ovId, apartment_id: aptId, checkin: "2099-03-12", checkout: "2099-03-13", nights: 1, source: "manual", status: "active" });
    if (!ov.error) { cleanup.push(ovId); bad("ustma-ust bron O'TIB KETDI!"); }
    else if (ov.error.code === "23P01") ok("ustma-ust bron rad etildi (23P01)");
    else bad(`ustma-ust: kutilmagan xato ${ov.error.code} — ${ov.error.message}`);
  }

  // 5) checkout must be > checkin (bookings_dates_valid check → 23514)
  const badId = base + "-BAD";
  const bd = await admin.from("bookings").insert({ id: badId, apartment_id: aptId, checkin: "2099-05-05", checkout: "2099-05-05", nights: 0, source: "manual", status: "active" });
  if (!bd.error) { cleanup.push(badId); bad("checkout == checkin O'TIB KETDI!"); }
  else if (bd.error.code === "23514") ok("checkout > checkin tekshiruvi (23514)");
  else bad(`sana tekshiruvi: kutilmagan xato ${bd.error.code} — ${bd.error.message}`);

  if (cleanup.length) await admin.from("bookings").delete().in("id", cleanup);
}

console.log(`\n${fail ? "❌" : "✅"} ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);

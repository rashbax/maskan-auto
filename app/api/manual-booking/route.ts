import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { pushToBeds24 } from "@/lib/booking-effects";
import { oneLine } from "@/lib/sanitize";

export const runtime = "nodejs";

const DAY = 86400000;
const MAX_NIGHTS = 366;

// Strict YYYY-MM-DD (rejects impossible calendar dates that Date.parse would silently normalize).
function validDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

async function requireAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin";
}

// Admin records an external booking (verbal / OLX / Booking.com). Unlike a direct client insert,
// this runs server-side so we can mirror "manual" bookings into Beds24 (pushToBeds24 self-gates by
// source: "manual" pushes, "booking" — already owned by the OTA — does not).
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const apartmentId = String(body.apartmentId || "");
  const from = String(body.from || "");
  const to = String(body.to || "");
  // same single-line sanitation as /api/book (these fields reach Telegram notices / Beds24 notes)
  const guestName = oneLine(body.guestName, 100);
  const phone = oneLine(body.phone, 32);
  const source = body.source === "booking" ? "booking" : "manual";
  const totalNum = Number(body.total);
  const total = Number.isFinite(totalNum) ? Math.max(0, Math.round(totalNum)) : null;
  // party size (optional): adults is nullable, children defaults to 0; clamp to sane non-negatives
  const clampCount = (v: unknown, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n))) : null;
  };
  const adults = clampCount(body.adults, 99);
  const children = clampCount(body.children, 99) ?? 0;

  if (!apartmentId || !validDate(from) || !validDate(to)) return NextResponse.json({ error: "bad_input" }, { status: 400 });
  const nights = Math.round((Date.parse(to) - Date.parse(from)) / DAY);
  if (nights < 1 || nights > MAX_NIGHTS) return NextResponse.json({ error: "bad_dates" }, { status: 400 });

  const sb = createAdminClient();

  // apartment must exist (price is admin-supplied here, so we don't derive it)
  const { data: apt } = await sb.from("apartments").select("id").eq("id", apartmentId).single();
  if (!apt) return NextResponse.json({ error: "unavailable" }, { status: 404 });

  const id = "BK-M-" + Date.now().toString().slice(-7);
  const { error } = await sb.from("bookings").insert({
    id,
    apartment_id: apartmentId,
    guest_name: guestName || null,
    phone: phone || null,
    checkin: from,
    checkout: to,
    nights,
    adults,
    children,
    total_usd: total,
    source,
    status: "active",
  });
  if (error) {
    // exclusion (23P01) or owner-blocked dates (23B01): the nights are already taken. Return a
    // message the admin form maps to its "overlap" notice.
    if (error.code === "23P01" || error.code === "23B01") return NextResponse.json({ error: "overlap" }, { status: 409 });
    console.error("manual booking insert failed:", error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  // Mirror manual bookings into Beds24 after the response so a slow Beds24 call never delays the
  // admin's confirmation. pushToBeds24 no-ops for "booking" source and for unmapped apartments.
  after(() => pushToBeds24(id));

  return NextResponse.json({ id });
}

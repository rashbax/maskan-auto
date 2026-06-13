import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOwner, pushToBeds24 } from "@/lib/booking-effects";

export const runtime = "nodejs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86400000;

// Trusted booking creation. The client sends only the request (dates, guest, party size); the
// server derives the price/nights from the DB, checks availability, and inserts with the service
// role. Direct public inserts are blocked by RLS (migration 0012), so this is the only guest path.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const apartmentId = String(body.apartmentId || "");
  const from = String(body.from || "");
  const to = String(body.to || "");
  const guestName = String(body.guestName || "").trim();
  const phone = String(body.phone || "").trim();
  const telegram = body.telegram ? String(body.telegram) : null;
  const messenger = body.messenger === "whatsapp" ? "whatsapp" : "telegram";
  const adults = Number(body.adults);
  const children = Number(body.children);

  // --- validate (never trust the client for price/nights/availability) ---
  if (!apartmentId || !DATE.test(from) || !DATE.test(to)) return NextResponse.json({ error: "bad_input" }, { status: 400 });
  const nights = Math.round((Date.parse(to) - Date.parse(from)) / DAY);
  if (!(nights >= 1)) return NextResponse.json({ error: "bad_dates" }, { status: 400 });
  const todayTashkent = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
  if (from < todayTashkent) return NextResponse.json({ error: "past_date" }, { status: 400 });
  if (!guestName) return NextResponse.json({ error: "name_required" }, { status: 400 });
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return NextResponse.json({ error: "bad_phone" }, { status: 400 });

  const sb = createAdminClient();

  // link the booking to the signed-in user, if a valid token was sent (anonymous otherwise)
  let userId: string | null = null;
  const authz = req.headers.get("authorization");
  if (authz?.startsWith("Bearer ")) {
    const { data } = await sb.auth.getUser(authz.slice(7));
    userId = data.user?.id ?? null;
  }

  // apartment must exist + be active; price comes from the DB, not the client
  const { data: apt } = await sb.from("apartments").select("price_usd, status, sleeps").eq("id", apartmentId).single();
  if (!apt || apt.status !== "active") return NextResponse.json({ error: "unavailable" }, { status: 404 });

  // owner-blocked days (the overlap of two bookings is enforced by the exclusion constraint below)
  const { data: blocks } = await sb
    .from("availability_blocks")
    .select("date")
    .eq("apartment_id", apartmentId)
    .gte("date", from)
    .lt("date", to)
    .limit(1);
  if (blocks?.length) return NextResponse.json({ error: "unavailable" }, { status: 409 });

  const cap = apt.sleeps || 1;
  const a = Number.isFinite(adults) ? Math.min(Math.max(adults, 1), cap) : 1;
  const c = Number.isFinite(children) ? Math.min(Math.max(children, 0), Math.max(0, cap - a)) : 0;
  const id = "BK-" + Date.now().toString().slice(-7);

  const { error } = await sb.from("bookings").insert({
    id,
    apartment_id: apartmentId,
    user_id: userId,
    guest_name: guestName,
    phone,
    telegram,
    messenger,
    adults: a,
    children: c,
    checkin: from,
    checkout: to,
    nights,
    total_usd: apt.price_usd * nights,
    source: "website",
    status: "active",
  });
  if (error) {
    // 23P01 = exclusion_violation — the dates were taken between the check and the insert
    if (error.code === "23P01") return NextResponse.json({ error: "unavailable" }, { status: 409 });
    console.error("book insert failed:", error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  // trusted side effects — await so they finish in this invocation; a failure won't fail the booking
  await Promise.allSettled([notifyOwner(id), pushToBeds24(id)]);

  return NextResponse.json({ id });
}

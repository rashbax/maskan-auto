import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cancelInBeds24, shortenInBeds24 } from "@/lib/booking-effects";

export const runtime = "nodejs";

const DAY = 86400000;
type Ctx = { params: Promise<{ id: string }> };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function validDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

async function requireAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin";
}

async function bookingExists(id: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("bookings").select("id").eq("id", id).maybeSingle();
  return !!data;
}

export async function PATCH(req: Request, ctx: Ctx) {
  if (!(await requireAdmin())) return json({ error: "forbidden" }, 403);
  const { id } = await ctx.params;

  let body: { status?: string; checkout?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  // cancel — keeps the row (status='cancelled'), cancels the Beds24 mirror first
  if (body.status === "cancelled") {
    if (!(await bookingExists(id))) return json({ error: "not_found" }, 404);
    const beds24 = await cancelInBeds24(id);
    if (!beds24.ok) return json({ error: "beds24_cancel_failed", beds24 }, 502);
    const admin = createAdminClient();
    const { error } = await admin.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) return json({ error: "update_failed" }, 500);
    return json({ ok: true, beds24 });
  }

  // early checkout — move the checkout earlier; prorate the total; the freed nights reopen
  if (typeof body.checkout === "string") return applyEarlyCheckout(id, body.checkout);

  return json({ error: "unsupported_op" }, 400);
}

async function applyEarlyCheckout(id: string, newCheckout: string) {
  if (!validDate(newCheckout)) return json({ error: "bad_date" }, 400);

  const admin = createAdminClient();
  const { data: b } = await admin
    .from("bookings")
    .select("id,apartment_id,checkin,checkout,nights,total_usd,status,source")
    .eq("id", id)
    .maybeSingle();
  if (!b) return json({ error: "not_found" }, 404);
  if (b.status !== "active") return json({ error: "not_active" }, 409);
  // OTA bookings are owned by the channel; shortening here would be reverted by the next sync
  if (b.source === "booking") return json({ error: "ota_not_editable" }, 409);
  // shorten only: the new checkout must sit strictly between check-in and the current checkout
  if (!(b.checkin < newCheckout && newCheckout < b.checkout)) return json({ error: "bad_range" }, 400);

  const oldNights = b.nights || Math.round((Date.parse(b.checkout) - Date.parse(b.checkin)) / DAY) || 1;
  const newNights = Math.round((Date.parse(newCheckout) - Date.parse(b.checkin)) / DAY);
  const newTotal = b.total_usd != null ? Math.round((b.total_usd / oldNights) * newNights) : null;
  const refund = b.total_usd != null && newTotal != null ? b.total_usd - newTotal : null;

  // shorten the Beds24 mirror first (website-origin only) so the OTAs reopen the freed nights;
  // fail-closed so we never free the site calendar while the mirror still blocks the dates
  const beds24 = await shortenInBeds24(id, newCheckout);
  if (!beds24.ok) return json({ error: "beds24_shorten_failed", beds24 }, 502);

  const { error } = await admin
    .from("bookings")
    .update({ checkout: newCheckout, nights: newNights, total_usd: newTotal })
    .eq("id", id);
  if (error) return json({ error: "update_failed" }, 500);
  return json({ ok: true, checkout: newCheckout, nights: newNights, total_usd: newTotal, refund, beds24 });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!(await requireAdmin())) return json({ error: "forbidden" }, 403);
  const { id } = await ctx.params;
  if (!(await bookingExists(id))) return json({ error: "not_found" }, 404);

  const beds24 = await cancelInBeds24(id);
  if (!beds24.ok) return json({ error: "beds24_cancel_failed", beds24 }, 502);

  const admin = createAdminClient();
  const { error } = await admin.from("bookings").delete().eq("id", id);
  if (error) return json({ error: "delete_failed" }, 500);
  return json({ ok: true, beds24 });
}

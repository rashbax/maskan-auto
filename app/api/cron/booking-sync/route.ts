import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOwner, pushToBeds24 } from "@/lib/booking-effects";

export const runtime = "nodejs";

const SECRET = process.env.CRON_SECRET;

// Durable retry for the booking side effects. `after()` in /api/book is best-effort (a crash or
// max-duration exit can drop it), so Vercel Cron hits this on a schedule and re-runs the IDEMPOTENT
// effects for recent bookings that still haven't completed them (notifyOwner claims notified_at;
// pushToBeds24 is gated by beds24_booking_id). Fail-closed on the shared secret Vercel sends.
export async function GET(req: Request) {
  if (!SECRET || req.headers.get("authorization") !== `Bearer ${SECRET}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sb = createAdminClient();
  const since = new Date(Date.now() - 2 * 86400000).toISOString(); // last 48h

  const { data: toNotify } = await sb
    .from("bookings")
    .select("id")
    .eq("source", "website").eq("status", "active")
    .is("notified_at", null).gte("created_at", since).limit(50);

  const { data: toPush } = await sb
    .from("bookings")
    .select("id")
    .eq("source", "website").eq("status", "active")
    .is("beds24_booking_id", null).gte("created_at", since).limit(50);

  await Promise.allSettled([
    ...(toNotify || []).map((b) => notifyOwner(b.id)),
    ...(toPush || []).map((b) => pushToBeds24(b.id)),
  ]);

  return NextResponse.json({ notified: toNotify?.length ?? 0, pushed: toPush?.length ?? 0 });
}

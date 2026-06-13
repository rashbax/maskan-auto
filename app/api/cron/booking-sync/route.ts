import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOwner, pushToBeds24 } from "@/lib/booking-effects";
import { beds24Enabled } from "@/lib/beds24";

export const runtime = "nodejs";
export const maxDuration = 60;

const SECRET = process.env.CRON_SECRET;

// Durable retry for the booking side effects. `after()` in /api/book is best-effort (a crash or
// max-duration exit can drop it), so Vercel Cron hits this on a schedule and re-runs the IDEMPOTENT
// effects for recent bookings that still haven't completed them (notifyOwner claims notified_at;
// pushToBeds24 is gated by beds24_booking_id). Fail-closed on the shared secret Vercel sends.
// Note: a 48h window deliberately bounds retries (a permanently-failing row won't loop forever); a
// full outbox with attempt/backoff tracking is the next step if unbounded durability is needed.
export async function GET(req: Request) {
  if (!SECRET || req.headers.get("authorization") !== `Bearer ${SECRET}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sb = createAdminClient();
  const since = new Date(Date.now() - 2 * 86400000).toISOString(); // last 48h

  const { data: toNotify, error: notifyErr } = await sb
    .from("bookings")
    .select("id")
    .eq("source", "website").eq("status", "active")
    .is("notified_at", null).gte("created_at", since)
    .order("created_at", { ascending: true }).limit(25);

  // Only retry pushes for apartments actually mapped to Beds24 — unmapped rows are skipped by
  // pushToBeds24 anyway, and including them would let them starve the limited page.
  const { data: toPush, error: pushErr } = beds24Enabled()
    ? await sb
        .from("bookings")
        .select("id, apartments!inner(beds24_room_id)")
        .eq("source", "website").eq("status", "active")
        .is("beds24_booking_id", null).not("apartments.beds24_room_id", "is", null)
        .gte("created_at", since).order("created_at", { ascending: true }).limit(25)
    : { data: [] as { id: string }[], error: null };

  if (notifyErr || pushErr) {
    console.error("cron booking-sync query failed:", notifyErr || pushErr);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  // Small concurrency cap so we don't hit Telegram/Beds24 rate limits or the function duration.
  const tasks = [
    ...(toNotify || []).map((b) => () => notifyOwner(b.id as string)),
    ...(toPush || []).map((b) => () => pushToBeds24((b as { id: string }).id)),
  ];
  for (let i = 0; i < tasks.length; i += 5) {
    await Promise.allSettled(tasks.slice(i, i + 5).map((t) => t()));
  }

  return NextResponse.json({ notified: toNotify?.length ?? 0, pushed: toPush?.length ?? 0 });
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOwner, pushBlockToBeds24, pushToBeds24 } from "@/lib/booking-effects";
import { beds24Enabled } from "@/lib/beds24";

export const runtime = "nodejs";
export const maxDuration = 60;

const SECRET = process.env.CRON_SECRET;

function tashkentToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
}

// Durable retry for the booking side effects. `after()` in /api/book is best-effort (a crash or
// max-duration exit can drop it), so Vercel Cron hits this on a schedule and re-runs the IDEMPOTENT
// effects for recent bookings that still haven't completed them (notifyOwner claims notified_at;
// pushToBeds24 is gated by beds24_booking_id). Fail-closed on the shared secret Vercel sends.
// Note: owner notifications use a 48h window (only recent bookings are worth pinging about);
// Beds24 pushes are instead bounded by the stay still lying ahead (checkout/date ≥ today), so a
// future stay keeps retrying until it syncs. A full outbox with attempt/backoff tracking is the
// next step if unbounded durability is needed.
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
  // Bound by CHECKOUT ≥ today (not created_at ≥ 48h): a stay that still lies ahead must keep
  // retrying until it syncs — otherwise a booking made before its apartment was mapped to Beds24,
  // or one older than 48h, would strand forever. Past stays need no OTA close, so they drop out.
  const { data: toPush, error: pushErr } = beds24Enabled()
    ? await sb
        .from("bookings")
        .select("id, apartments!inner(beds24_room_id)")
        .in("source", ["website", "manual"]).eq("status", "active")
        .is("beds24_booking_id", null).not("apartments.beds24_room_id", "is", null)
        .gte("checkout", tashkentToday()).order("checkout", { ascending: true }).limit(25)
    : { data: [] as { id: string }[], error: null };

  const { data: toPushBlocks, error: blockPushErr } = beds24Enabled()
    ? await sb
        .from("availability_blocks")
        .select("id, apartments!inner(beds24_room_id)")
        .is("beds24_booking_id", null)
        .not("apartments.beds24_room_id", "is", null)
        .gte("date", tashkentToday())
        .order("date", { ascending: true })
        .limit(25)
    : { data: [] as { id: string }[], error: null };

  if (notifyErr || pushErr || blockPushErr) {
    console.error("cron booking-sync query failed:", notifyErr || pushErr || blockPushErr);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  // Small concurrency cap so we don't hit Telegram/Beds24 rate limits or the function duration.
  const tasks = [
    ...(toNotify || []).map((b) => () => notifyOwner(b.id as string)),
    ...(toPush || []).map((b) => () => pushToBeds24((b as { id: string }).id)),
    ...(toPushBlocks || []).map((b) => () => pushBlockToBeds24((b as { id: string }).id)),
  ];
  for (let i = 0; i < tasks.length; i += 5) {
    await Promise.allSettled(tasks.slice(i, i + 5).map((t) => t()));
  }

  return NextResponse.json({
    notified: toNotify?.length ?? 0,
    pushed: toPush?.length ?? 0,
    blocksPushed: toPushBlocks?.length ?? 0,
  });
}

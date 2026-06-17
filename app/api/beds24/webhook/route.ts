import { NextResponse } from "next/server";
import { syncBeds24Bookings } from "@/lib/beds24-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

const SECRET = process.env.BEDS24_WEBHOOK_SECRET;

type WebhookPayload = {
  booking?: Record<string, unknown>;
  bookingId?: unknown;
  id?: unknown;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function str(v: unknown) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function authorized(req: Request) {
  const url = new URL(req.url);
  const headerSecret = req.headers.get("x-beds24-webhook-secret");
  const auth = req.headers.get("authorization");
  return !!SECRET && (
    headerSecret === SECRET ||
    auth === `Bearer ${SECRET}` ||
    url.searchParams.get("secret") === SECRET
  );
}

function bookingId(payload: WebhookPayload) {
  return str(payload.booking?.id) || str(payload.bookingId) || str(payload.id);
}

export async function GET(req: Request) {
  if (!authorized(req)) return json({ error: "forbidden" }, 403);
  return json({ ok: true, configured: true });
}

export async function POST(req: Request) {
  if (!authorized(req)) return json({ error: "forbidden" }, 403);

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const id = bookingId(payload);
  if (!id) {
    return json({ ok: true, skipped: "missing_booking_id" });
  }

  const summary = await syncBeds24Bookings({ bookingIds: [id] });
  return json({ ok: !summary.error, bookingId: id, summary }, summary.error ? 502 : 200);
}

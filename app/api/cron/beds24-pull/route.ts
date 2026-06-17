import { NextResponse } from "next/server";
import { defaultBeds24Window, syncBeds24Bookings, validDate } from "@/lib/beds24-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

const SECRET = process.env.CRON_SECRET;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function authorized(req: Request) {
  return !!SECRET && req.headers.get("authorization") === `Bearer ${SECRET}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return json({ error: "forbidden" }, 403);

  const url = new URL(req.url);
  const defaults = defaultBeds24Window();
  const from = url.searchParams.get("from") || defaults.from;
  const to = url.searchParams.get("to") || defaults.to;
  if (!validDate(from) || !validDate(to) || from >= to) return json({ error: "bad_window" }, 400);

  const summary = await syncBeds24Bookings({ from, to });
  return json(summary, summary.error ? 502 : 200);
}

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { beds24Enabled, validateToken, setupFromInviteCode, getProperties, getBookings } from "@/lib/beds24";

export const runtime = "nodejs";

const KEY = process.env.BEDS24_DIAG_KEY?.trim();
const BEDS24_STATUSES = ["confirmed", "request", "new", "cancelled", "black", "inquiry"];

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

function keyOk(provided: string | null): boolean {
  // trim both sides — a stray newline/space pasted into the env var would otherwise fail the
  // length check and reject an otherwise-correct key
  const p = provided?.trim();
  if (!KEY || !p) return false;
  const a = Buffer.from(p);
  const b = Buffer.from(KEY);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authorized(req: Request, url: URL) {
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  return keyOk(req.headers.get("x-beds24-diag-key")) || keyOk(bearer) || keyOk(url.searchParams.get("key"));
}

function bookingId(url: URL) {
  const id = url.searchParams.get("booking") || url.searchParams.get("bookingId") || url.searchParams.get("id");
  return id && /^\d+$/.test(id) ? id : null;
}

// Read-only checks — no long-lived secret in the response, so a query key is acceptable here.
//   GET /api/beds24/diag?key=...          -> { enabled, validToken }
//   GET /api/beds24/diag?key=...&props=1  -> properties + rooms (read off propertyId / roomId)
export async function GET(req: Request) {
  if (!KEY) return json({ error: "diag_disabled" }, 503);
  const url = new URL(req.url);
  if (!authorized(req, url)) return json({ error: "forbidden" }, 403);

  if (!beds24Enabled()) return json({ enabled: false });
  try {
    const id = bookingId(url);
    if (id) {
      const response = await getBookings({ id, status: BEDS24_STATUSES });
      const rows = Array.isArray(response.data) ? response.data : [];
      return json({
        enabled: true,
        bookingId: id,
        count: rows.length,
        fields: rows.map((row) => Object.keys(row).sort()),
        data: rows,
      });
    }
    if (url.searchParams.get("props")) return json(await getProperties());
    const v = await validateToken();
    return json({ enabled: true, validToken: v.validToken });
  } catch (e) {
    return json({ enabled: true, error: String(e) }, 502);
  }
}

// One-time invite-code → refresh-token exchange. The refresh token is long-lived and powerful, so
// keep it out of URLs/history/logs: key goes in a header, invite code in the body, never cached.
//   curl -X POST https://maskan-24.uz/api/beds24/diag \
//        -H "x-beds24-diag-key: <KEY>" -H "content-type: application/json" -d '{"code":"<INVITE>"}'
export async function POST(req: Request) {
  if (!KEY) return json({ error: "diag_disabled" }, 503);
  if (!keyOk(req.headers.get("x-beds24-diag-key"))) return json({ error: "forbidden" }, 403);
  let code: string | undefined;
  try {
    code = (await req.json())?.code;
  } catch {
    /* no/!json body */
  }
  if (!code) return json({ error: "no_code" }, 400);
  try {
    const t = await setupFromInviteCode(code);
    return json({ refreshToken: t.refreshToken, expiresIn: t.expiresIn });
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
}

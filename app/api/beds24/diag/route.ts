import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { beds24Enabled, validateToken, setupFromInviteCode, getProperties } from "@/lib/beds24";

export const runtime = "nodejs";

const KEY = process.env.BEDS24_DIAG_KEY;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

function keyOk(provided: string | null): boolean {
  if (!KEY || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(KEY);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Read-only checks — no long-lived secret in the response, so a query key is acceptable here.
//   GET /api/beds24/diag?key=...          -> { enabled, validToken }
//   GET /api/beds24/diag?key=...&props=1  -> properties + rooms (read off propertyId / roomId)
export async function GET(req: Request) {
  if (!KEY) return json({ error: "diag_disabled" }, 503);
  const url = new URL(req.url);
  if (!keyOk(url.searchParams.get("key"))) return json({ error: "forbidden" }, 403);

  if (!beds24Enabled()) return json({ enabled: false });
  try {
    if (url.searchParams.get("props")) return json(await getProperties());
    const v = await validateToken();
    return json({ enabled: true, validToken: v.validToken });
  } catch (e) {
    return json({ enabled: true, error: String(e) }, 502);
  }
}

// One-time invite-code → refresh-token exchange. The refresh token is long-lived and powerful, so
// keep it out of URLs/history/logs: key goes in a header, invite code in the body, never cached.
//   curl -X POST https://maskan-auto.vercel.app/api/beds24/diag \
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

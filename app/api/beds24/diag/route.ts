import { NextResponse } from "next/server";
import { beds24Enabled, validateToken, setupFromInviteCode } from "@/lib/beds24";

export const runtime = "nodejs";

const KEY = process.env.BEDS24_DIAG_KEY;

// Admin smoke-test / one-time setup for the Beds24 connection. Fail-closed: needs BEDS24_DIAG_KEY.
//   GET /api/beds24/diag?key=...            -> { enabled, validToken }
//   GET /api/beds24/diag?key=...&setup=CODE -> exchange an invite code for a refresh token (once)
export async function GET(req: Request) {
  if (!KEY) return NextResponse.json({ error: "diag_disabled" }, { status: 503 });
  const url = new URL(req.url);
  if (url.searchParams.get("key") !== KEY) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const setup = url.searchParams.get("setup");
  if (setup) {
    try {
      const t = await setupFromInviteCode(setup);
      // Shown once so it can be copied into BEDS24_REFRESH_TOKEN — never logged elsewhere.
      return NextResponse.json({ refreshToken: t.refreshToken, expiresIn: t.expiresIn });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 502 });
    }
  }

  if (!beds24Enabled()) return NextResponse.json({ enabled: false });
  try {
    const v = await validateToken();
    return NextResponse.json({ enabled: true, validToken: v.validToken });
  } catch (e) {
    return NextResponse.json({ enabled: true, error: String(e) }, { status: 502 });
  }
}

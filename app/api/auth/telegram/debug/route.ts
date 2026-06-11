import { NextResponse } from "next/server";

export const runtime = "nodejs";

// TEMPORARY diagnostic: shows what host/proto Vercel actually provides, so we can build the
// correct public origin for the magic-link redirect. Remove after the redirect is verified.
export async function GET(req: Request) {
  const url = new URL(req.url);
  return NextResponse.json({
    reqUrlOrigin: url.origin,
    host: req.headers.get("host"),
    xForwardedHost: req.headers.get("x-forwarded-host"),
    xForwardedProto: req.headers.get("x-forwarded-proto"),
  });
}

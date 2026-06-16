import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { mintTelegramSession } from "@/lib/telegram-session";
import { SITE_URL } from "@/lib/site-url";

export const runtime = "nodejs";

const TTL_MS = 5 * 60 * 1000; // a nonce is valid for 5 minutes
const NO_STORE = { "Cache-Control": "no-store" } as const;

// The login page polls this until the bot webhook confirms the nonce, then we mint a one-time
// Supabase magic link. The poller must be the same browser that started the flow (verifier cookie).
export async function GET(req: NextRequest) {
  const nonce = req.nextUrl.searchParams.get("nonce");
  if (!nonce) return NextResponse.json({ status: "error" }, { status: 400, headers: NO_STORE });

  const sb = createAdminClient();
  const { data } = await sb.from("telegram_login").select("*").eq("nonce", nonce).single();
  if (!data) return NextResponse.json({ status: "expired" }, { headers: NO_STORE });

  // bind to the initiating browser
  const v = req.cookies.get("tg_login")?.value;
  const vh = v ? createHash("sha256").update(v).digest("hex") : "";
  if (!data.verifier_hash || vh !== data.verifier_hash) {
    return NextResponse.json({ status: "error" }, { status: 403, headers: NO_STORE });
  }

  if (Date.now() - new Date(data.created_at).getTime() > TTL_MS) {
    await sb.from("telegram_login").delete().eq("nonce", nonce);
    return NextResponse.json({ status: "expired" }, { headers: NO_STORE });
  }
  if (data.status !== "confirmed" || !data.telegram_id) {
    return NextResponse.json({ status: "pending" }, { headers: NO_STORE });
  }

  // atomic claim — only the caller that actually deletes the row gets to mint (no double-redeem)
  const { data: claimed } = await sb.from("telegram_login").delete().eq("nonce", nonce).eq("status", "confirmed").select().maybeSingle();
  if (!claimed) return NextResponse.json({ status: "pending" }, { headers: NO_STORE });

  // Pin the magic-link origin to a trusted host so a forged x-forwarded-host can't redirect the
  // one-time link to an attacker domain. SITE_URL wins; in production fall back to the canonical
  // URL (never the request headers); only dev uses the request host (localhost).
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin =
    process.env.SITE_URL?.replace(/\/$/, "") ||
    (process.env.NODE_ENV === "production" ? SITE_URL : `${proto}://${host}`);

  const link = await mintTelegramSession(
    { id: claimed.telegram_id, first_name: claimed.first_name, last_name: claimed.last_name, username: claimed.username, photo_url: claimed.photo_url },
    origin,
  );
  if (!link) return NextResponse.json({ status: "error" }, { headers: NO_STORE });
  return NextResponse.json({ status: "confirmed", url: link }, { headers: NO_STORE });
}

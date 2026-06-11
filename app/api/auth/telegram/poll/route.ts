import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mintTelegramSession } from "@/lib/telegram-session";

export const runtime = "nodejs";

const TTL_MS = 5 * 60 * 1000; // a nonce is valid for 5 minutes

// The login page polls this until the bot webhook confirms the nonce, then we mint a
// one-time Supabase magic link and hand it back for the browser to redirect to.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const nonce = url.searchParams.get("nonce");
  if (!nonce) return NextResponse.json({ status: "error" }, { status: 400 });

  const sb = createAdminClient();
  const { data } = await sb.from("telegram_login").select("*").eq("nonce", nonce).single();
  if (!data) return NextResponse.json({ status: "expired" });

  if (Date.now() - new Date(data.created_at).getTime() > TTL_MS) {
    await sb.from("telegram_login").delete().eq("nonce", nonce);
    return NextResponse.json({ status: "expired" });
  }
  if (data.status !== "confirmed" || !data.telegram_id) {
    return NextResponse.json({ status: "pending" });
  }

  // confirmed → mint the session and burn the nonce (single use)
  const link = await mintTelegramSession(
    { id: data.telegram_id, first_name: data.first_name, last_name: data.last_name, username: data.username, photo_url: data.photo_url },
    url.origin,
  );
  await sb.from("telegram_login").delete().eq("nonce", nonce);
  if (!link) return NextResponse.json({ status: "error" });
  return NextResponse.json({ status: "confirmed", url: link });
}

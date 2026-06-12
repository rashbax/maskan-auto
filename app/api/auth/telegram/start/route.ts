import { NextResponse } from "next/server";
import { randomUUID, createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BOT = process.env.TELEGRAM_BOT_USERNAME || "maskan_tashkentbot";

// Begin a bot-based login: create a pending nonce + a browser-bound verifier (kept in an
// httpOnly cookie) and hand back the deep link to open (t.me/<bot>?start=<nonce>).
export async function POST(req: Request) {
  let lang = "uz";
  try {
    const b = await req.json();
    if (typeof b?.lang === "string" && ["uz", "ru", "en"].includes(b.lang)) lang = b.lang;
  } catch { /* no body — default uz */ }

  const nonce = randomUUID().replace(/-/g, "");
  const verifier = randomUUID().replace(/-/g, "");
  const sb = createAdminClient();

  // opportunistic cleanup of stale rows (no cron needed)
  await sb.from("telegram_login").delete().lt("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

  const { error } = await sb.from("telegram_login").insert({
    nonce,
    status: "pending",
    lang,
    verifier_hash: createHash("sha256").update(verifier).digest("hex"),
  });
  if (error) return NextResponse.json({ error: "init_failed" }, { status: 500 });

  const res = NextResponse.json({ nonce, url: `https://t.me/${BOT}?start=${nonce}` });
  res.cookies.set("tg_login", verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/telegram",
    maxAge: 600,
  });
  return res;
}

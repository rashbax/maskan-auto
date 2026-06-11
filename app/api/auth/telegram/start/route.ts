import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BOT = process.env.TELEGRAM_BOT_USERNAME || "maskan_tashkentbot";

// Begin a bot-based login: create a pending nonce and hand back the deep link the
// browser should open (t.me/<bot>?start=<nonce>).
export async function POST() {
  const nonce = randomUUID().replace(/-/g, "");
  const sb = createAdminClient();
  const { error } = await sb.from("telegram_login").insert({ nonce, status: "pending" });
  if (error) return NextResponse.json({ error: "init_failed" }, { status: 500 });
  return NextResponse.json({ nonce, url: `https://t.me/${BOT}?start=${nonce}` });
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const OWNER = process.env.TELEGRAM_OWNER_CHAT_ID;

async function send(chatId: number | string, text: string) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
}

// Telegram bot webhook: delivers a booking confirmation to the guest on /start <id>,
// and relays any other guest message to the owner.
export async function POST(req: Request) {
  if (!TOKEN) return NextResponse.json({ skipped: true });
  if (SECRET && req.headers.get("x-telegram-bot-api-secret-token") !== SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let update: { message?: { chat?: { id?: number }; text?: string; from?: { id?: number; first_name?: string; last_name?: string; username?: string } } };
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;
  const chatId = msg?.chat?.id;
  const text = msg?.text || "";
  if (!chatId) return NextResponse.json({ ok: true });

  if (text.startsWith("/start")) {
    // /start <nonce> = a website login request. Confirm the nonce with this verified user.
    const nonce = text.split(/\s+/)[1];
    const from = msg?.from;
    if (nonce && from?.id) {
      const sb = createAdminClient();
      const { data: row } = await sb.from("telegram_login").select("status").eq("nonce", nonce).single();
      if (row && row.status === "pending") {
        await sb.from("telegram_login").update({
          status: "confirmed",
          telegram_id: String(from.id),
          first_name: from.first_name || null,
          last_name: from.last_name || null,
          username: from.username || null,
        }).eq("nonce", nonce);
        await send(chatId, "✅ Maskan'ga kirdingiz! Brauzerga qaytishingiz mumkin.");
        return NextResponse.json({ ok: true });
      }
    }
    // plain /start (or unknown/expired nonce): just a welcome. No booking details revealed.
    await send(chatId, "Salom! Maskan botiga xush kelibsiz. Savolingiz boʻlsa shu yerga yozing — javob beramiz.");
    return NextResponse.json({ ok: true });
  }

  // relay any other guest message to the owner
  if (OWNER && String(chatId) !== String(OWNER) && text) {
    const who = `${msg?.from?.first_name || ""} ${msg?.from?.username ? "@" + msg.from.username : ""}`.trim();
    await send(OWNER, `💬 Mehmon ${who} (id ${chatId}):\n${text}`);
    await send(chatId, "Xabaringiz qabul qilindi — tez orada javob beramiz.");
  }
  return NextResponse.json({ ok: true });
}

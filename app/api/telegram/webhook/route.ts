import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const OWNER = process.env.TELEGRAM_OWNER_CHAT_ID;

async function send(chatId: number | string, text: string, extra: Record<string, unknown> = {}) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true, ...extra }),
  });
}

type From = { id?: number; first_name?: string; last_name?: string; username?: string };

// Telegram bot webhook. Confirms a website login ONLY after the user taps an explicit consent
// button (so an attacker can't have a victim's /start stamp a nonce the attacker initiated).
export async function POST(req: Request) {
  // Fail CLOSED — an unauthenticated webhook could mint a session for any Telegram user.
  if (!TOKEN || !SECRET) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (req.headers.get("x-telegram-bot-api-secret-token") !== SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let update: {
    message?: { chat?: { id?: number }; text?: string; from?: From };
    callback_query?: { id?: string; data?: string; from?: From; message?: { chat?: { id?: number } } };
  };
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // --- consent tapped: "✅ Ha, bu men — kirish" → confirm the nonce (atomic) ---
  const cb = update.callback_query;
  if (cb?.data?.startsWith("login:") && cb.from?.id) {
    const nonce = cb.data.slice("login:".length);
    const sb = createAdminClient();
    const { data: upd } = await sb
      .from("telegram_login")
      .update({
        status: "confirmed",
        telegram_id: String(cb.from.id),
        first_name: cb.from.first_name || null,
        last_name: cb.from.last_name || null,
        username: cb.from.username || null,
      })
      .eq("nonce", nonce)
      .eq("status", "pending") // only one confirmer wins
      .select()
      .maybeSingle();
    await fetch(`https://api.telegram.org/bot${TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: cb.id, text: upd ? "✅" : "Muddati oʻtgan" }),
    });
    const cbChat = cb.message?.chat?.id;
    if (upd && cbChat) await send(cbChat, "✅ Maskan'ga kirdingiz! Brauzerga qaytishingiz mumkin.");
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;
  const chatId = msg?.chat?.id;
  const text = msg?.text || "";
  if (!chatId) return NextResponse.json({ ok: true });

  // --- /start <nonce>: do NOT auto-confirm — ask for explicit consent with context ---
  if (text.startsWith("/start ")) {
    const nonce = text.split(/\s+/)[1];
    if (nonce && msg?.from?.id) {
      const sb = createAdminClient();
      const { data: row } = await sb.from("telegram_login").select("status").eq("nonce", nonce).single();
      if (row?.status === "pending") {
        await send(chatId, "🔐 maskan-auto.vercel.app saytiga kirish soʻraldi.\n\nAgar buni SIZ boshlamagan boʻlsangiz, tasdiqlamang.", {
          reply_markup: { inline_keyboard: [[{ text: "✅ Ha, bu men — kirish", callback_data: `login:${nonce}` }]] },
        });
        return NextResponse.json({ ok: true });
      }
    }
    // unknown/expired nonce → fall through to the welcome
  }

  if (text === "/start" || text.startsWith("/start ")) {
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

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

  let update: { message?: { chat?: { id?: number }; text?: string; from?: { first_name?: string; username?: string } } };
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
    const payload = text.split(" ")[1]?.trim();
    if (payload) {
      const sb = createAdminClient();
      const { data: b } = await sb.from("bookings").select("*").eq("id", payload).single();
      if (b) {
        const { data: apt } = await sb.from("apartments").select("title").eq("id", b.apartment_id).single();
        const title = apt?.title?.uz || apt?.title?.ru || b.apartment_id;
        await send(chatId, [
          "✅ Broningiz tasdiqlandi — Maskan",
          `🏠 ${title}`,
          `📅 ${b.checkin} → ${b.checkout} (${b.nights} kecha)`,
          `💵 $${b.total_usd ?? "—"}`,
          `🔖 ${b.id}`,
          "",
          "Uy egasi kelishingizdan oldin shu yerda bogʻlanib, aniq manzil va kalitlarni beradi.",
          "Savolingiz boʻlsa — shu chatga yozavering.",
        ].join("\n"));
        return NextResponse.json({ ok: true });
      }
    }
    await send(chatId, "Salom! Maskan botiga xush kelibsiz. Bron qilganingizdan soʻng tasdiq shu yerga keladi.");
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

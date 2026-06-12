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

const CONSENT = {
  uz: {
    text: "👋 Assalomu alaykum! Maskan'ga xush kelibsiz 🏡\n\nToshkent boʻylab eng qulay kunlik kvartiralar shu yerda. Hisobingizga kirsangiz — yoqqan kvartiralarni saqlash va bron qilish ancha oson boʻladi.\n\nProfilingizga kirish uchun pastdagi tugmani bosing 👇",
    button: "✅ Ha, kirishni tasdiqlayman",
    done: "🎉 Tayyor! Maskan'ga kirdingiz. Endi brauzerga qayting — sizni zoʻr kvartiralar kutyapti 🏡",
  },
  ru: {
    text: "👋 Здравствуйте! Добро пожаловать в Maskan 🏡\n\nЛучшие посуточные квартиры Ташкента — здесь. Войдите в аккаунт, чтобы сохранять понравившиеся варианты и бронировать в пару кликов.\n\nЧтобы войти в профиль, нажмите кнопку ниже 👇",
    button: "✅ Да, войти",
    done: "🎉 Готово! Вы вошли в Maskan. Возвращайтесь в браузер — вас ждут отличные квартиры 🏡",
  },
  en: {
    text: "👋 Hello! Welcome to Maskan 🏡\n\nTashkent's best daily apartments are right here. Sign in to save your favourites and book in just a couple of taps.\n\nTo sign in to your profile, tap the button below 👇",
    button: "✅ Yes, sign in",
    done: "🎉 Done! You're signed in to Maskan. Head back to your browser — great apartments await 🏡",
  },
} as const;

const pick = (lang?: string) => CONSENT[(lang as keyof typeof CONSENT)] || CONSENT.uz;

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
    if (upd && cbChat) await send(cbChat, pick((upd as { lang?: string }).lang).done);
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
      const { data: row } = await sb.from("telegram_login").select("status, lang").eq("nonce", nonce).single();
      if (row?.status === "pending") {
        const c = pick(row.lang);
        await send(chatId, c.text, { reply_markup: { inline_keyboard: [[{ text: c.button, callback_data: `login:${nonce}` }]] } });
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

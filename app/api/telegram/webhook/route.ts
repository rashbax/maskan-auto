import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_CHAT_IDS, isAdmin } from "@/lib/admins";
import { oneLine } from "@/lib/sanitize";

export const runtime = "nodejs";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

// Returns whether Telegram accepted the message (ok:false e.g. when the user blocked the bot or
// never started it). Bounded so a hung Telegram call can't stall the webhook into a retry storm.
async function send(chatId: number | string, text: string, extra: Record<string, unknown> = {}): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true, ...extra }),
      signal: AbortSignal.timeout(8000),
    });
    return (await res.json())?.ok === true;
  } catch {
    return false;
  }
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

// The user's language on top, with the Uzbek version below it (the audience is Uzbek-first, and
// many read Uzbek better than the ru/en they happened to pick). Deduped when already Uzbek.
function bilingual(lang: string | undefined, key: "text" | "done") {
  const c = pick(lang);
  return c === CONSENT.uz ? CONSENT.uz[key] : `${c[key]}\n\n— — —\n\n${CONSENT.uz[key]}`;
}

// Apartment enquiry: the guest tapped "Telegram" on an apartment. We greet by apartment name and
// invite them to write here — the bot remembers the apartment (telegram_contact) and tags every
// relayed message with it, so the operator always sees which apartment the message is about.
const ENQUIRY = {
  uz: (t: string) => `🏡 ${t}\n\nShu kvartira boʻyicha savolingizni shu yerga yozing — egamiz tez orada javob beradi.`,
  ru: (t: string) => `🏡 ${t}\n\nНапишите ваш вопрос об этой квартире прямо здесь — хозяин скоро ответит.`,
  en: (t: string) => `🏡 ${t}\n\nWrite your question about this apartment here — the host will reply shortly.`,
} as const;

// Post-booking: the guest tapped Telegram on the confirmation to get keys/address for a booking.
const BOOK = {
  uz: "Kalit va manzil uchun savolingizni shu yerga yozing — egamiz javob beradi.",
  ru: "Напишите здесь для получения ключей и адреса — хозяин ответит.",
  en: "Write here for keys and the address — the host will reply.",
} as const;

// Telegram bot webhook. Confirms a website login ONLY after the user taps an explicit consent
// button (so an attacker can't have a victim's /start stamp a nonce the attacker initiated).
export async function POST(req: Request) {
  // Fail CLOSED — an unauthenticated webhook could mint a session for any Telegram user.
  if (!TOKEN || !SECRET) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (req.headers.get("x-telegram-bot-api-secret-token") !== SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let update: {
    message?: { chat?: { id?: number }; text?: string; from?: From; reply_to_message?: { text?: string } };
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
    if (upd && cbChat) await send(cbChat, bilingual((upd as { lang?: string }).lang, "done"));
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;
  const chatId = msg?.chat?.id;
  const text = msg?.text || "";
  if (!chatId) return NextResponse.json({ ok: true });

  // --- /id: anyone can fetch their numeric chat id. Used to add a new admin: that account opens
  // the bot, sends /id, and the returned number goes into TELEGRAM_OWNER_CHAT_ID (comma-separated).
  if (text === "/id" || text === "/whoami") {
    await send(chatId, `🆔 ${chatId}`);
    return NextResponse.json({ ok: true });
  }

  // --- An ADMIN replies (Telegram "Reply") to a relayed guest message → deliver it to that guest.
  // Booking notices and relayed messages carry "🆔 <chatId>"; parse it from the quoted message.
  // This is the ONLY way to answer guests who have no public @username (a bare id isn't clickable).
  if (isAdmin(chatId) && text && msg?.reply_to_message?.text) {
    // Line-anchored: only the notice's own "🆔 <chatId>" line can match. Guest-supplied fields
    // are sanitized to a single mid-line fragment (lib/sanitize), so they can't fake a line
    // start; in the relay format the genuine 🆔 line precedes the guest text, so it wins.
    const m = msg.reply_to_message.text.match(/^🆔 (\d+)\b/m);
    if (m) {
      const ok = await send(m[1], text);
      await send(chatId, ok
        ? "✅ Mehmonga yuborildi."
        : "⚠️ Yetkazib boʻlmadi — mehmon botni bloklagan yoki Start bosmagan boʻlishi mumkin. Telefon/Telegram orqali urinib koʻring.");
      return NextResponse.json({ ok: true });
    }
  }

  // --- /start <payload> ---
  if (text.startsWith("/start ")) {
    const payload = text.split(/\s+/)[1] || "";

    // (A0) post-booking deep-link: start=book_<bookingId>_<lang> → keys/address with full context
    if (payload.startsWith("book_")) {
      const rest = payload.slice("book_".length);
      const u = rest.lastIndexOf("_");
      const bookingId = u === -1 ? rest : rest.slice(0, u);
      const lng = u === -1 ? "uz" : rest.slice(u + 1);
      const lang = (["uz", "ru", "en"].includes(lng) ? lng : "uz") as keyof typeof BOOK;
      const sb = createAdminClient();
      const { data: bk } = await sb.from("bookings").select("apartment_id, checkin, checkout").eq("id", bookingId).single();
      let title = bookingId;
      let aptId: string | null = null;
      if (bk?.apartment_id) {
        aptId = bk.apartment_id;
        const { data: apt } = await sb.from("apartments").select("title").eq("id", bk.apartment_id).single();
        title = (apt?.title as Record<string, string> | null)?.[lang] || (apt?.title as Record<string, string> | null)?.uz || bk.apartment_id;
      }
      const dates = bk ? `\n📅 ${bk.checkin} → ${bk.checkout}` : "";
      await sb.from("telegram_contact").upsert({ chat_id: String(chatId), apartment_id: aptId, title, booking_id: bookingId, updated_at: new Date().toISOString() });
      await send(chatId, `🔑 ${title}${dates}\n🔖 ${bookingId}\n\n${BOOK[lang]}`);
      return NextResponse.json({ ok: true });
    }

    // (A) apartment enquiry deep-link: start=<aptId>_<lang> → greet the guest + hand off to host.
    // Match by the trailing _<lang> so it works for numeric ids ("483920_uz") and legacy
    // "apt-..." ids alike; login nonces are 32 hex chars with no _<lang> suffix, so they fall through.
    if (/_(uz|ru|en)$/.test(payload)) {
      const us = payload.indexOf("_");
      const aptId = us === -1 ? payload : payload.slice(0, us);
      const lng = us === -1 ? "uz" : payload.slice(us + 1);
      const lang = (["uz", "ru", "en"].includes(lng) ? lng : "uz") as keyof typeof ENQUIRY;
      const sb = createAdminClient();
      const { data: apt } = await sb.from("apartments").select("title").eq("id", aptId).single();
      const title = (apt?.title as Record<string, string> | null)?.[lang] || (apt?.title as Record<string, string> | null)?.uz || aptId;
      await sb.from("telegram_contact").upsert({ chat_id: String(chatId), apartment_id: aptId, title, booking_id: null, updated_at: new Date().toISOString() });
      await send(chatId, ENQUIRY[lang](title));
      return NextResponse.json({ ok: true });
    }

    // (B) login nonce → do NOT auto-confirm; ask for explicit consent with context
    const nonce = payload;
    if (nonce && msg?.from?.id) {
      const sb = createAdminClient();
      const { data: row } = await sb.from("telegram_login").select("status, lang").eq("nonce", nonce).single();
      if (row?.status === "pending") {
        const c = pick(row.lang);
        await send(chatId, bilingual(row.lang, "text"), { reply_markup: { inline_keyboard: [[{ text: c.button, callback_data: `login:${nonce}` }]] } });
        return NextResponse.json({ ok: true });
      }
    }
    // unknown/expired nonce → fall through to the welcome
  }

  if (text === "/start" || text.startsWith("/start ")) {
    await send(chatId, "Salom! Maskan botiga xush kelibsiz. Savolingiz boʻlsa shu yerga yozing — javob beramiz.");
    return NextResponse.json({ ok: true });
  }

  // relay any guest message to every admin, TAGGED with the apartment/booking it came from
  if (ADMIN_CHAT_IDS.length && !isAdmin(chatId) && text) {
    const sb = createAdminClient();
    const { data: ctx } = await sb.from("telegram_contact").select("title, booking_id").eq("chat_id", String(chatId)).maybeSingle();
    const who = oneLine(`${msg?.from?.first_name || ""} ${msg?.from?.username ? "@" + msg.from.username : ""}`, 64) || `id ${chatId}`;
    const head = ctx?.title
      ? `💬 ${ctx.title}${ctx.booking_id ? ` · 🔖 ${ctx.booking_id}` : ""}\n👤 ${who}`
      : `💬 ${who}`;
    // Always embed the chat id so any admin can answer by replying (works even without @username).
    const relay = `${head}\n🆔 ${chatId}:\n${text}\n\n↩️ Javob berish uchun shu xabarga "Reply" qiling.`;
    for (const admin of ADMIN_CHAT_IDS) await send(admin, relay);
    await send(chatId, "Xabaringiz qabul qilindi — tez orada javob beramiz.");
  }
  return NextResponse.json({ ok: true });
}

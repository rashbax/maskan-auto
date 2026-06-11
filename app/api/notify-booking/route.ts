import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_OWNER_CHAT_ID;

// Notifies the owner of a new booking. SECURITY: takes only a booking id and
// builds the message from the trusted DB row (the client can't inject content).
export async function POST(req: Request) {
  if (!TOKEN || !CHAT) {
    return NextResponse.json({ skipped: "telegram_not_configured" });
  }

  let id: string | undefined;
  try {
    id = (await req.json())?.id;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: "no_id" }, { status: 400 });

  const sb = createAdminClient();
  const { data: b } = await sb.from("bookings").select("*").eq("id", id).single();
  if (!b) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: apt } = await sb.from("apartments").select("title,district").eq("id", b.apartment_id).single();

  const title = apt?.title?.uz || apt?.title?.ru || apt?.title?.en || b.apartment_id;

  // If the guest signed in with Telegram, we already have their @username — show it even
  // when they didn't type one into the booking form.
  let acctUser: string | undefined;
  if (b.user_id) {
    const { data: u } = await sb.auth.admin.getUserById(b.user_id);
    acctUser = (u?.user?.user_metadata as { user_name?: string } | undefined)?.user_name;
  }
  const tgHandle = b.telegram || (acctUser ? "@" + acctUser : "");

  const text = [
    "🆕 Yangi bron!",
    `🏠 ${title}`,
    `📅 ${b.checkin} → ${b.checkout} (${b.nights} kecha)`,
    `👤 ${b.guest_name || "—"}`,
    b.adults != null ? `👥 ${b.adults} katta${b.children ? `, ${b.children} bola` : ""}` : null,
    `📞 ${b.phone || "—"}${tgHandle ? " · " + tgHandle : ""}`,
    `💬 Afzal: ${b.messenger}`,
    `💵 $${b.total_usd ?? "—"}`,
    `🔖 ${b.id}`,
    "",
    "Mehmon bilan bogʻlanib, kelishda kalit va manzilni bering.",
  ].filter(Boolean).join("\n");

  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT, text, disable_web_page_preview: true }),
  });
  const j = await res.json();
  return NextResponse.json({ ok: !!j.ok, result: j.ok ? "sent" : j.description });
}

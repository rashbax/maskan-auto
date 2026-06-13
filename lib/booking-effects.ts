// Trusted server-side side effects for a new booking. Called by /api/book after the row is
// committed — never exposed as a public endpoint. Both no-op gracefully when unconfigured.
import { createAdminClient } from "@/lib/supabase/admin";
import { beds24Enabled, pushBooking } from "@/lib/beds24";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_OWNER_CHAT_ID;

// Notify the host of a new booking. Idempotent: claims notified_at atomically so it can't be
// sent twice; releases the claim if the send fails so it can be retried.
export async function notifyOwner(id: string) {
  if (!TOKEN || !CHAT) return;
  const sb = createAdminClient();
  const { data: b, error } = await sb
    .from("bookings")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", id)
    .is("notified_at", null)
    .select("*")
    .maybeSingle();
  if (error || !b) return;

  const { data: apt } = await sb.from("apartments").select("title").eq("id", b.apartment_id).single();
  const title = (apt?.title as Record<string, string> | null)?.uz || (apt?.title as Record<string, string> | null)?.ru || b.apartment_id;

  // If the guest signed in with Telegram, surface their @username even if they didn't type one.
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

  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT, text, disable_web_page_preview: true }),
    });
    const j = await res.json();
    if (!j.ok) await sb.from("bookings").update({ notified_at: null }).eq("id", id); // release for retry
  } catch {
    await sb.from("bookings").update({ notified_at: null }).eq("id", id);
  }
}

// Mirror our own active website booking into Beds24 so the dates close on connected OTAs.
export async function pushToBeds24(id: string) {
  if (!beds24Enabled()) return;
  const sb = createAdminClient();
  const { data: b } = await sb.from("bookings").select("*").eq("id", id).single();
  if (!b || b.beds24_booking_id) return;
  if (b.source !== "website" || b.status !== "active") return;

  const { data: apt } = await sb
    .from("apartments")
    .select("beds24_room_id, beds24_prop_id")
    .eq("id", b.apartment_id)
    .single();
  const roomId = apt?.beds24_room_id ? Number(apt.beds24_room_id) : null;

  const log = (ok: boolean, detail: string, beds24Id?: string | null) =>
    sb.from("beds24_sync_log").insert({
      direction: "outbound",
      beds24_booking_id: beds24Id ?? null,
      booking_id: id,
      apartment_id: b.apartment_id,
      action: "push",
      ok,
      detail: detail.slice(0, 500),
    });

  if (!roomId) {
    await log(false, "apartment not mapped to a Beds24 room");
    return;
  }

  try {
    const resp = await pushBooking({
      roomId,
      ...(apt?.beds24_prop_id ? { propertyId: Number(apt.beds24_prop_id) } : {}),
      status: "confirmed",
      arrival: b.checkin,
      departure: b.checkout,
      firstName: b.guest_name || "Maskan guest",
      notes: `Maskan ${b.id}${b.phone ? " · " + b.phone : ""}`,
    });
    const r = (Array.isArray(resp) ? resp[0] : resp) as { new?: { id?: number }; id?: number; bookId?: number } | undefined;
    const newId = r?.new?.id ?? r?.id ?? r?.bookId;
    if (newId) await sb.from("bookings").update({ beds24_booking_id: String(newId) }).eq("id", id);
    await log(true, JSON.stringify(resp), newId ? String(newId) : null);
  } catch (e) {
    await log(false, String(e));
  }
}

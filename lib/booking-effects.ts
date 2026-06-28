// Trusted server-side side effects for a new booking. Called by /api/book after the row is
// committed — never exposed as a public endpoint. Both no-op gracefully when unconfigured.
import { createAdminClient } from "@/lib/supabase/admin";
import { beds24Enabled, pushBooking } from "@/lib/beds24";
import { ADMIN_CHAT_IDS } from "@/lib/admins";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DAY = 86400000;

function addDays(iso: string, days: number) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

// Notify the host of a new booking. Idempotent: claims notified_at atomically so it can't be
// sent twice; releases the claim if the send fails so it can be retried.
export async function notifyOwner(id: string) {
  if (!TOKEN || ADMIN_CHAT_IDS.length === 0) return;
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

  // If the guest signed in with Telegram, surface their @username (even if they didn't type one)
  // and their chat id, so an admin can answer by replying to this notice (see the webhook relay).
  let acctUser: string | undefined;
  let tgId: string | undefined;
  if (b.user_id) {
    const { data: u } = await sb.auth.admin.getUserById(b.user_id);
    const meta = u?.user?.user_metadata as { user_name?: string; telegram_id?: string } | undefined;
    acctUser = meta?.user_name;
    tgId = meta?.telegram_id;
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
    tgId ? `🆔 ${tgId}` : null, // lets an admin reach the guest by replying to this message
    "",
    tgId
      ? "Mehmon bilan bogʻlanish: shu xabarga \"Reply\" qiling yoki tel/Telegram orqali."
      : "Mehmon bilan bogʻlanib, kelishda kalit va manzilni bering.",
  ].filter(Boolean).join("\n");

  // Deliver to every admin. Keep notified_at set if at least one got it (don't spam on retry);
  // only release the claim if every admin failed, so the cron can retry the whole notice.
  let anyOk = false;
  for (const chat of ADMIN_CHAT_IDS) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(8000),
      });
      const j = await res.json();
      if (j.ok) anyOk = true;
    } catch {
      /* try the next admin */
    }
  }
  if (!anyOk) await sb.from("bookings").update({ notified_at: null }).eq("id", id); // release for retry
}

// Bookings that originate in Maskan (the website + admin-entered manual ones) and so must be
// mirrored OUT to Beds24. OTA-origin ("booking") rows are owned by the channel — never push them back.
const OWNED_SOURCES = ["website", "manual"];

// Mirror one of our own active bookings into Beds24 so the dates close on connected OTAs.
export async function pushToBeds24(id: string) {
  if (!beds24Enabled()) return;
  const sb = createAdminClient();
  const { data: b } = await sb.from("bookings").select("*").eq("id", id).single();
  if (!b || b.beds24_booking_id) return;
  if (!OWNED_SOURCES.includes(b.source) || b.status !== "active") return;

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

  if (!roomId) return; // apartment isn't connected to Beds24 — expected, nothing to mirror

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

// Cancel the Beds24 mirror for bookings that originated in Maskan (website + manual). OTA-origin
// bookings should be cancelled in the OTA/Beds24 first, then pulled back into Maskan.
export async function cancelInBeds24(id: string) {
  if (!beds24Enabled()) return { ok: true, skipped: "beds24_not_configured" };
  const sb = createAdminClient();
  const { data: b } = await sb.from("bookings").select("*").eq("id", id).single();
  if (!b) return { ok: false, error: "booking_not_found" };
  if (!OWNED_SOURCES.includes(b.source)) return { ok: true, skipped: "not_owned_source" };
  if (!b.beds24_booking_id) return { ok: true, skipped: "no_beds24_booking_id" };

  const { data: apt } = await sb
    .from("apartments")
    .select("beds24_room_id, beds24_prop_id")
    .eq("id", b.apartment_id)
    .single();
  const roomId = apt?.beds24_room_id ? Number(apt.beds24_room_id) : null;

  const log = (ok: boolean, detail: string) =>
    sb.from("beds24_sync_log").insert({
      direction: "outbound",
      beds24_booking_id: b.beds24_booking_id,
      booking_id: id,
      apartment_id: b.apartment_id,
      action: "cancel",
      ok,
      detail: detail.slice(0, 500),
    });

  if (!roomId) {
    await log(false, "missing_beds24_room_id");
    return { ok: false, error: "missing_beds24_room_id" };
  }

  try {
    const resp = await pushBooking({
      id: /^\d+$/.test(String(b.beds24_booking_id)) ? Number(b.beds24_booking_id) : String(b.beds24_booking_id),
      roomId,
      ...(apt?.beds24_prop_id ? { propertyId: Number(apt.beds24_prop_id) } : {}),
      status: "cancelled",
      arrival: b.checkin,
      departure: b.checkout,
      firstName: b.guest_name || "Maskan guest",
      notes: `Maskan ${b.id} cancelled from site`,
    });
    await log(true, JSON.stringify(resp));
    return { ok: true, response: resp };
  } catch (e) {
    await log(false, String(e));
    return { ok: false, error: String(e) };
  }
}

// Mirror an owner calendar block into Beds24 as a black booking. This closes the night on
// connected OTAs without creating a guest booking in Maskan.
export async function pushBlockToBeds24(id: string) {
  if (!beds24Enabled()) return { ok: true, skipped: "beds24_not_configured" };
  const sb = createAdminClient();
  const { data: block } = await sb
    .from("availability_blocks")
    .select("id,apartment_id,date,beds24_booking_id")
    .eq("id", id)
    .single();
  if (!block) return { ok: false, error: "block_not_found" };
  if (block.beds24_booking_id) return { ok: true, skipped: "already_synced", beds24Id: block.beds24_booking_id };

  const { data: apt } = await sb
    .from("apartments")
    .select("beds24_room_id, beds24_prop_id")
    .eq("id", block.apartment_id)
    .single();
  const roomId = apt?.beds24_room_id ? Number(apt.beds24_room_id) : null;

  const log = (ok: boolean, detail: string, beds24Id?: string | null) =>
    sb.from("beds24_sync_log").insert({
      direction: "outbound",
      beds24_booking_id: beds24Id ?? null,
      booking_id: `BLOCK:${block.id}`,
      apartment_id: block.apartment_id,
      action: "block_push",
      ok,
      detail: detail.slice(0, 500),
    });

  if (!roomId) return { ok: true, skipped: "missing_beds24_room_id" };

  try {
    const resp = await pushBooking({
      roomId,
      ...(apt?.beds24_prop_id ? { propertyId: Number(apt.beds24_prop_id) } : {}),
      status: "black",
      arrival: block.date,
      departure: addDays(block.date, 1),
      firstName: "Maskan",
      lastName: "Block",
      notes: `Maskan block ${block.id}`,
    });
    const r = (Array.isArray(resp) ? resp[0] : resp) as { new?: { id?: number }; id?: number; bookId?: number } | undefined;
    const newId = r?.new?.id ?? r?.id ?? r?.bookId;
    if (!newId) {
      await log(false, JSON.stringify(resp));
      return { ok: false, error: "beds24_missing_block_id", response: resp };
    }
    await sb.from("availability_blocks").update({ beds24_booking_id: String(newId) }).eq("id", id);
    await log(true, JSON.stringify(resp), String(newId));
    return { ok: true, beds24Id: String(newId), response: resp };
  } catch (e) {
    await log(false, String(e));
    return { ok: false, error: String(e) };
  }
}

export async function cancelBlockInBeds24(id: string) {
  if (!beds24Enabled()) return { ok: true, skipped: "beds24_not_configured" };
  const sb = createAdminClient();
  const { data: block } = await sb
    .from("availability_blocks")
    .select("id,apartment_id,date,beds24_booking_id")
    .eq("id", id)
    .single();
  if (!block) return { ok: false, error: "block_not_found" };
  if (!block.beds24_booking_id) return { ok: true, skipped: "no_beds24_booking_id" };

  const { data: apt } = await sb
    .from("apartments")
    .select("beds24_room_id, beds24_prop_id")
    .eq("id", block.apartment_id)
    .single();
  const roomId = apt?.beds24_room_id ? Number(apt.beds24_room_id) : null;

  const log = (ok: boolean, detail: string) =>
    sb.from("beds24_sync_log").insert({
      direction: "outbound",
      beds24_booking_id: block.beds24_booking_id,
      booking_id: `BLOCK:${block.id}`,
      apartment_id: block.apartment_id,
      action: "block_cancel",
      ok,
      detail: detail.slice(0, 500),
    });

  if (!roomId) {
    await log(false, "missing_beds24_room_id");
    return { ok: false, error: "missing_beds24_room_id" };
  }

  try {
    const resp = await pushBooking({
      id: /^\d+$/.test(String(block.beds24_booking_id)) ? Number(block.beds24_booking_id) : String(block.beds24_booking_id),
      roomId,
      ...(apt?.beds24_prop_id ? { propertyId: Number(apt.beds24_prop_id) } : {}),
      status: "cancelled",
      arrival: block.date,
      departure: addDays(block.date, 1),
      firstName: "Maskan",
      lastName: "Block",
      notes: `Maskan block ${block.id} opened from site`,
    });
    await log(true, JSON.stringify(resp));
    return { ok: true, response: resp };
  } catch (e) {
    await log(false, String(e));
    return { ok: false, error: String(e) };
  }
}

// Early checkout: shorten a website-origin booking's Beds24 mirror so the freed nights reopen on
// the OTAs. OTA-origin bookings are owned by the channel and are left untouched here.
export async function shortenInBeds24(id: string, newCheckout: string) {
  if (!beds24Enabled()) return { ok: true, skipped: "beds24_not_configured" };
  const sb = createAdminClient();
  const { data: b } = await sb.from("bookings").select("*").eq("id", id).single();
  if (!b) return { ok: false, error: "booking_not_found" };
  if (!OWNED_SOURCES.includes(b.source)) return { ok: true, skipped: "not_owned_source" };
  if (!b.beds24_booking_id) return { ok: true, skipped: "no_beds24_booking_id" };

  const { data: apt } = await sb
    .from("apartments")
    .select("beds24_room_id, beds24_prop_id")
    .eq("id", b.apartment_id)
    .single();
  const roomId = apt?.beds24_room_id ? Number(apt.beds24_room_id) : null;

  const log = (ok: boolean, detail: string) =>
    sb.from("beds24_sync_log").insert({
      direction: "outbound",
      beds24_booking_id: b.beds24_booking_id,
      booking_id: id,
      apartment_id: b.apartment_id,
      action: "shorten",
      ok,
      detail: detail.slice(0, 500),
    });

  if (!roomId) {
    await log(false, "missing_beds24_room_id");
    return { ok: false, error: "missing_beds24_room_id" };
  }

  try {
    const resp = await pushBooking({
      id: /^\d+$/.test(String(b.beds24_booking_id)) ? Number(b.beds24_booking_id) : String(b.beds24_booking_id),
      roomId,
      ...(apt?.beds24_prop_id ? { propertyId: Number(apt.beds24_prop_id) } : {}),
      status: "confirmed",
      arrival: b.checkin,
      departure: newCheckout,
      firstName: b.guest_name || "Maskan guest",
      notes: `Maskan ${b.id} shortened to ${newCheckout}`,
    });
    await log(true, JSON.stringify(resp));
    return { ok: true, response: resp };
  } catch (e) {
    await log(false, String(e));
    return { ok: false, error: String(e) };
  }
}

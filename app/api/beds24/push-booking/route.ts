import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { beds24Enabled, pushBooking } from "@/lib/beds24";

export const runtime = "nodejs";

// OUTBOUND sync: after a site booking, mirror it into Beds24 so the dates close on connected OTAs.
// Takes only a booking id and reads the trusted DB row (the client can't inject content). No-ops
// gracefully if Beds24 isn't configured or the apartment isn't mapped to a Beds24 room.
export async function POST(req: Request) {
  if (!beds24Enabled()) return NextResponse.json({ skipped: "beds24_not_configured" });

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
  if (b.beds24_booking_id) return NextResponse.json({ skipped: "already_synced" });

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
    return NextResponse.json({ skipped: "apartment_not_mapped" });
  }

  try {
    const resp = await pushBooking({
      roomId,
      ...(apt?.beds24_prop_id ? { propertyId: Number(apt.beds24_prop_id) } : {}),
      status: "confirmed", // closes the dates on connected channels (verify value on smoke test)
      arrival: b.checkin,
      departure: b.checkout,
      firstName: b.guest_name || "Maskan guest",
      notes: `Maskan ${b.id}${b.phone ? " · " + b.phone : ""}`,
    });
    // POST /bookings returns an array of results; extract the new id best-effort (verify on smoke test).
    const r = (Array.isArray(resp) ? resp[0] : resp) as { new?: { id?: number }; id?: number; bookId?: number } | undefined;
    const newId = r?.new?.id ?? r?.id ?? r?.bookId;
    if (newId) await sb.from("bookings").update({ beds24_booking_id: String(newId) }).eq("id", id);
    await log(true, JSON.stringify(resp), newId ? String(newId) : null);
    return NextResponse.json({ ok: true, beds24_booking_id: newId ?? null });
  } catch (e) {
    await log(false, String(e));
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { beds24Enabled, getBookings, type Beds24Booking } from "@/lib/beds24";

export const runtime = "nodejs";
export const maxDuration = 60;

const SECRET = process.env.CRON_SECRET;
const DAY = 86400000;
const HORIZON_DAYS = 365;

type ApartmentRow = {
  id: string;
  beds24_prop_id: string | null;
  beds24_room_id: string | null;
};

type ExistingBooking = {
  id: string;
  apartment_id: string;
  guest_name: string | null;
  phone: string | null;
  checkin: string;
  checkout: string;
  nights: number | null;
  total_usd: number | null;
  source: string;
  status: string;
  beds24_booking_id: string | null;
};

type Beds24Record = Beds24Booking & Record<string, unknown>;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function authorized(req: Request) {
  return !!SECRET && req.headers.get("authorization") === `Bearer ${SECRET}`;
}

function tashkentToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
}

function addDays(iso: string, days: number) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

function validDate(s: string | null) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function nightsBetween(checkin: string, checkout: string) {
  return Math.round((Date.parse(checkout) - Date.parse(checkin)) / DAY);
}

function str(v: unknown) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function num(v: unknown) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function nested(obj: Record<string, unknown>, key: string) {
  const v = obj[key];
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function pickString(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const v = str(obj[key]);
    if (v) return v;
  }
  return null;
}

function pickNestedString(obj: Record<string, unknown>, paths: string[][]) {
  for (const path of paths) {
    let cur: Record<string, unknown> | null = obj;
    for (let i = 0; i < path.length - 1; i++) cur = cur ? nested(cur, path[i]) : null;
    if (!cur) continue;
    const v = str(cur[path[path.length - 1]]);
    if (v) return v;
  }
  return null;
}

function beds24Id(b: Beds24Record) {
  return pickString(b, ["id", "bookId", "bookingId"]);
}

function roomId(b: Beds24Record) {
  return (
    pickString(b, ["roomId", "roomID", "roomid"]) ||
    pickNestedString(b, [["room", "id"], ["room", "roomId"], ["unit", "roomId"]])
  );
}

function arrival(b: Beds24Record) {
  return pickString(b, ["arrival", "checkIn", "checkin", "arrivalDate"]);
}

function departure(b: Beds24Record) {
  return pickString(b, ["departure", "checkOut", "checkout", "departureDate"]);
}

function statusOf(b: Beds24Record) {
  const status = (pickString(b, ["status", "bookingStatus"]) || "confirmed").toLowerCase();
  if (status.includes("cancel")) return "cancelled";
  return "active";
}

function guestName(b: Beds24Record) {
  const direct = pickString(b, ["guestName", "name", "fullName"]);
  if (direct) return direct;
  const first = pickString(b, ["firstName", "firstname"]) || pickNestedString(b, [["guest", "firstName"], ["guest", "name"]]);
  const last = pickString(b, ["lastName", "lastname"]) || pickNestedString(b, [["guest", "lastName"]]);
  return [first, last].filter(Boolean).join(" ").trim() || "Booking.com guest";
}

function phone(b: Beds24Record) {
  return pickString(b, ["phone", "mobile", "guestPhone"]) || pickNestedString(b, [["guest", "phone"], ["guest", "mobile"]]);
}

function totalUsd(b: Beds24Record) {
  return num(b.price) ?? num(b.total) ?? num(b.totalPrice) ?? num(b.amount);
}

function changed(existing: ExistingBooking, next: Partial<ExistingBooking>, keys: (keyof ExistingBooking)[]) {
  return keys.some((key) => (existing[key] ?? null) !== (next[key] ?? null));
}

async function logSync(
  sb: ReturnType<typeof createAdminClient>,
  row: { beds24Id?: string | null; bookingId?: string | null; apartmentId?: string | null; action: string; ok: boolean; detail: string },
) {
  await sb.from("beds24_sync_log").insert({
    direction: "inbound",
    beds24_booking_id: row.beds24Id ?? null,
    booking_id: row.bookingId ?? null,
    apartment_id: row.apartmentId ?? null,
    action: row.action,
    ok: row.ok,
    detail: row.detail.slice(0, 500),
  });
}

export async function GET(req: Request) {
  if (!authorized(req)) return json({ error: "forbidden" }, 403);
  if (!beds24Enabled()) return json({ enabled: false });

  const url = new URL(req.url);
  const today = tashkentToday();
  const from = url.searchParams.get("from") || addDays(today, -1);
  const to = url.searchParams.get("to") || addDays(today, HORIZON_DAYS);
  if (!validDate(from) || !validDate(to) || from >= to) return json({ error: "bad_window" }, 400);

  const sb = createAdminClient();
  const { data: apartments, error: aptErr } = await sb
    .from("apartments")
    .select("id,beds24_prop_id,beds24_room_id")
    .not("beds24_room_id", "is", null);
  if (aptErr) return json({ error: "apartments_query_failed" }, 500);

  const roomToApartment = new Map<string, ApartmentRow>();
  for (const apt of (apartments || []) as ApartmentRow[]) {
    if (apt.beds24_room_id) roomToApartment.set(apt.beds24_room_id, apt);
  }
  if (!roomToApartment.size) return json({ enabled: true, imported: 0, updated: 0, unchanged: 0, skipped: 0, errors: 0 });

  let response: { data?: Beds24Booking[]; success?: boolean; count?: number };
  try {
    response = await getBookings({ arrivalFrom: from, departureTo: to });
  } catch (e) {
    return json({ enabled: true, error: String(e) }, 502);
  }

  const rows = Array.isArray(response.data) ? (response.data as Beds24Record[]) : [];
  let imported = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  let errors = 0;

  for (const b of rows) {
    const b24Id = beds24Id(b);
    const bRoomId = roomId(b);
    const apt = bRoomId ? roomToApartment.get(bRoomId) : null;
    const checkin = arrival(b);
    const checkout = departure(b);

    if (!b24Id || !apt || !validDate(checkin) || !validDate(checkout) || checkin! >= checkout!) {
      skipped++;
      continue;
    }

    const nights = nightsBetween(checkin!, checkout!);
    const status = statusOf(b);
    const base = {
      apartment_id: apt.id,
      checkin: checkin!,
      checkout: checkout!,
      nights,
      total_usd: totalUsd(b),
      status,
    };

    const { data: existing, error: existingErr } = await sb
      .from("bookings")
      .select("id,apartment_id,guest_name,phone,checkin,checkout,nights,total_usd,source,status,beds24_booking_id")
      .eq("beds24_booking_id", b24Id)
      .maybeSingle();

    if (existingErr) {
      errors++;
      await logSync(sb, { beds24Id: b24Id, apartmentId: apt.id, action: "lookup", ok: false, detail: JSON.stringify(existingErr) });
      continue;
    }

    if (existing) {
      const e = existing as ExistingBooking;
      const guestFields = e.source === "website" ? {} : { guest_name: guestName(b), phone: phone(b) };
      const next = { ...base, ...guestFields };
      const keys = Object.keys(next) as (keyof ExistingBooking)[];
      if (!changed(e, next, keys)) {
        unchanged++;
        continue;
      }
      const { error } = await sb.from("bookings").update(next).eq("id", e.id);
      if (error) {
        errors++;
        await logSync(sb, { beds24Id: b24Id, bookingId: e.id, apartmentId: apt.id, action: "update", ok: false, detail: JSON.stringify(error) });
      } else {
        updated++;
        await logSync(sb, { beds24Id: b24Id, bookingId: e.id, apartmentId: apt.id, action: "update", ok: true, detail: JSON.stringify({ status, checkin, checkout }) });
      }
      continue;
    }

    const bookingId = `B24-${b24Id}`;
    const { error } = await sb.from("bookings").insert({
      id: bookingId,
      ...base,
      beds24_booking_id: b24Id,
      source: "booking",
      guest_name: guestName(b),
      phone: phone(b),
    });
    if (error) {
      errors++;
      await logSync(sb, { beds24Id: b24Id, bookingId, apartmentId: apt.id, action: "insert", ok: false, detail: JSON.stringify(error) });
    } else {
      imported++;
      await logSync(sb, { beds24Id: b24Id, bookingId, apartmentId: apt.id, action: "insert", ok: true, detail: JSON.stringify({ status, checkin, checkout }) });
    }
  }

  return json({
    enabled: true,
    window: { from, to },
    beds24Count: rows.length,
    imported,
    updated,
    unchanged,
    skipped,
    errors,
  });
}

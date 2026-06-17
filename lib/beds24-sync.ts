import { beds24Enabled, getBookings, type Beds24Booking } from "@/lib/beds24";
import { createAdminClient } from "@/lib/supabase/admin";

const DAY = 86400000;
const HORIZON_DAYS = 365;
const BEDS24_STATUSES = ["confirmed", "request", "new", "cancelled", "black", "inquiry"];

type ApartmentRow = {
  id: string;
  beds24_prop_id: string | null;
  beds24_room_id: string | null;
  price_usd: number | null;
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

export type Beds24SyncSummary = {
  enabled: boolean;
  window?: { from: string; to: string };
  bookingIds?: string[];
  beds24Count?: number;
  imported?: number;
  updated?: number;
  unchanged?: number;
  skipped?: number;
  errors?: number;
  error?: string;
};

export function tashkentToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
}

export function addDays(iso: string, days: number) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

export function defaultBeds24Window() {
  const today = tashkentToday();
  return { from: addDays(today, -1), to: addDays(today, HORIZON_DAYS) };
}

export function validDate(s: string | null | undefined) {
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

function rawStatusOf(b: Beds24Record) {
  return (pickString(b, ["status", "bookingStatus"]) || "confirmed").toLowerCase();
}

function isManualBlock(b: Beds24Record) {
  const status = rawStatusOf(b);
  return status.includes("black") || status.includes("block");
}

function statusOf(b: Beds24Record) {
  const status = rawStatusOf(b);
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

async function fetchRows(opts: { from?: string; to?: string; bookingIds?: string[] }) {
  if (opts.bookingIds?.length) {
    const byId = new Map<string, Beds24Record>();
    for (const id of opts.bookingIds) {
      const response = await getBookings({ id, status: BEDS24_STATUSES });
      for (const row of (response.data || []) as Beds24Record[]) {
        const key = beds24Id(row) || JSON.stringify(row);
        byId.set(key, row);
      }
    }
    return [...byId.values()];
  }

  if (!opts.from || !opts.to) throw new Error("beds24_sync_window_required");
  const response = await getBookings({ arrivalFrom: opts.from, departureTo: opts.to, status: BEDS24_STATUSES });
  return Array.isArray(response.data) ? (response.data as Beds24Record[]) : [];
}

export async function syncBeds24Bookings(opts: { from?: string; to?: string; bookingIds?: string[] } = {}): Promise<Beds24SyncSummary> {
  if (!beds24Enabled()) return { enabled: false };

  const sb = createAdminClient();
  const { data: apartments, error: aptErr } = await sb
    .from("apartments")
    .select("id,beds24_prop_id,beds24_room_id,price_usd")
    .not("beds24_room_id", "is", null);
  if (aptErr) return { enabled: true, error: "apartments_query_failed" };

  const roomToApartment = new Map<string, ApartmentRow>();
  for (const apt of (apartments || []) as ApartmentRow[]) {
    if (apt.beds24_room_id) roomToApartment.set(apt.beds24_room_id, apt);
  }
  if (!roomToApartment.size) {
    return { enabled: true, imported: 0, updated: 0, unchanged: 0, skipped: 0, errors: 0 };
  }

  let rows: Beds24Record[];
  try {
    rows = await fetchRows(opts);
  } catch (e) {
    return { enabled: true, error: String(e) };
  }

  let imported = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  let errors = 0;

  for (const b of rows) {
    if (isManualBlock(b)) {
      skipped++;
      continue;
    }

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
    // Price in USD from the listing (price_usd * nights). The Beds24 price comes in the booking's
    // own currency (often UZS) and is usually absent, so we don't trust it for total_usd; fall back
    // to it only when the apartment has no listing price.
    const total_usd = apt.price_usd != null ? Math.round(apt.price_usd * nights) : totalUsd(b);
    const base = {
      apartment_id: apt.id,
      checkin: checkin!,
      checkout: checkout!,
      nights,
      total_usd,
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

    if (status !== "active") {
      skipped++;
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

  return {
    enabled: true,
    ...(opts.from && opts.to ? { window: { from: opts.from, to: opts.to } } : {}),
    ...(opts.bookingIds?.length ? { bookingIds: opts.bookingIds } : {}),
    beds24Count: rows.length,
    imported,
    updated,
    unchanged,
    skipped,
    errors,
  };
}

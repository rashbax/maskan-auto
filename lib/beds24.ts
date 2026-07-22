// Beds24 API v2 client.
//
// Token model: a long-lived REFRESH token (obtained once by exchanging an invite code from
// Beds24 Settings → API) lives in env. It's traded for short-lived ACCESS tokens, cached in
// memory per serverless instance. Everything no-ops if BEDS24_REFRESH_TOKEN is unset, so the
// site runs normally before Beds24 is connected.
//
// Base host + the token header are verified live (GET /authentication/details → { validToken }).
// Write/booking payload field names are per Beds24 API v2 and should be smoke-tested against a
// real token before relying on them in production.

const BASE = process.env.BEDS24_API_BASE || "https://api.beds24.com/v2";
// trim — a stray newline/space in the env var would otherwise corrupt the refreshToken header
const REFRESH = process.env.BEDS24_REFRESH_TOKEN?.trim();

export const beds24Enabled = () => !!REFRESH;

let cached: { token: string; exp: number } | null = null;

// Trade the long-lived refresh token for a short-lived access token (cached until ~1 min before expiry).
async function accessToken(): Promise<string> {
  if (!REFRESH) throw new Error("beds24_not_configured");
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const res = await fetch(`${BASE}/authentication/token`, { headers: { refreshToken: REFRESH }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`beds24_token_failed_${res.status}`);
  const j = (await res.json()) as { token: string; expiresIn?: number };
  cached = { token: j.token, exp: Date.now() + (j.expiresIn ?? 86400) * 1000 };
  return j.token;
}

async function b24<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { token, "Content-Type": "application/json", ...(init.headers || {}) },
    signal: init.signal ?? AbortSignal.timeout(8000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`beds24_${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j as T;
}

// One-time setup: exchange an invite code (Beds24 Settings → API → generate invite code) for a
// refresh token. Run once (e.g. from /api/beds24/diag?setup=<code>), then store the returned
// refreshToken in BEDS24_REFRESH_TOKEN. Refresh tokens are long-lived; keep it secret.
export async function setupFromInviteCode(code: string, deviceName = "maskan-site") {
  const res = await fetch(`${BASE}/authentication/setup`, { headers: { code, deviceName }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`beds24_setup_failed_${res.status}`);
  return (await res.json()) as { token: string; refreshToken: string; expiresIn: number };
}

// Confirms the current access token is valid (cheap smoke test).
export function validateToken() {
  return b24<{ validToken: boolean }>("/authentication/details");
}

// List properties + their rooms — handy for reading off propertyId / roomId after connecting.
export function getProperties() {
  return b24<unknown>("/properties?includeAllRooms=true");
}

// Beds24 pages /bookings at 100 rows; a busy window would otherwise silently truncate there
// (verified live: nextPageExists=true past page 2). Bounded so a runaway response can't spin
// the cron past its time budget (~1s/page; the daily window is a handful of pages at most).
const MAX_BOOKING_PAGES = 20;

// INBOUND: bookings changed since a timestamp, for the periodic pull. Params are passed through
// to Beds24 (e.g. { propertyId, roomId, modifiedFrom, arrivalFrom, departureTo }). Follows
// `pages.nextPageExists` and aggregates every page so the caller sees the FULL window.
export async function getBookings(params: Record<string, string | string[]>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
    else qs.set(key, value);
  }
  const all: Beds24Booking[] = [];
  for (let page = 1; page <= MAX_BOOKING_PAGES; page++) {
    qs.set("page", String(page));
    const res = await b24<{ success?: boolean; data?: Beds24Booking[]; pages?: { nextPageExists?: boolean } }>(`/bookings?${qs}`);
    all.push(...(res.data || []));
    if (!res.pages?.nextPageExists) break;
    if (page === MAX_BOOKING_PAGES) {
      // the cap is a safety valve, not an expected state — surface it, never truncate silently
      console.error(`beds24 getBookings: truncated at ${MAX_BOOKING_PAGES} pages (${all.length} rows) — narrow the window`);
    }
  }
  return { success: true, data: all };
}

// OUTBOUND: create/update bookings. Beds24 accepts an array; including `id` updates an existing row.
export function writeBookings(bookings: Beds24BookingWrite[]) {
  return b24<unknown>("/bookings", { method: "POST", body: JSON.stringify(bookings) });
}

// OUTBOUND: push a booking so Beds24 closes the dates on connected OTAs.
export function pushBooking(booking: Beds24BookingWrite) {
  return writeBookings([booking]);
}

// Minimal shapes we rely on (Beds24 returns many more fields).
export interface Beds24Booking {
  id: number;
  propertyId?: number;
  roomId?: number;
  status?: string; // e.g. confirmed / new / cancelled
  arrival: string; // YYYY-MM-DD
  departure: string; // YYYY-MM-DD
  firstName?: string;
  lastName?: string;
  referer?: string; // channel/source (Booking.com, Airbnb, ...)
}

export interface Beds24BookingWrite {
  id?: number | string;
  roomId: number;
  propertyId?: number;
  status: string; // "confirmed" to block the dates
  arrival: string;
  departure: string;
  firstName?: string;
  lastName?: string;
  notes?: string;
}

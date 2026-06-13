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
const REFRESH = process.env.BEDS24_REFRESH_TOKEN;

export const beds24Enabled = () => !!REFRESH;

let cached: { token: string; exp: number } | null = null;

// Trade the long-lived refresh token for a short-lived access token (cached until ~1 min before expiry).
async function accessToken(): Promise<string> {
  if (!REFRESH) throw new Error("beds24_not_configured");
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const res = await fetch(`${BASE}/authentication/token`, { headers: { refreshToken: REFRESH } });
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
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`beds24_${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j as T;
}

// One-time setup: exchange an invite code (Beds24 Settings → API → generate invite code) for a
// refresh token. Run once (e.g. from /api/beds24/diag?setup=<code>), then store the returned
// refreshToken in BEDS24_REFRESH_TOKEN. Refresh tokens are long-lived; keep it secret.
export async function setupFromInviteCode(code: string, deviceName = "maskan-site") {
  const res = await fetch(`${BASE}/authentication/setup`, { headers: { code, deviceName } });
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

// INBOUND: bookings changed since a timestamp, for the periodic pull. Params are passed through
// to Beds24 (e.g. { propertyId, roomId, modifiedFrom, arrivalFrom, departureTo }).
export function getBookings(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return b24<{ success?: boolean; data?: Beds24Booking[] }>(`/bookings?${qs}`);
}

// OUTBOUND: push a booking so Beds24 closes the dates on connected OTAs. Beds24 accepts an array.
export function pushBooking(booking: Beds24BookingWrite) {
  return b24<unknown>("/bookings", { method: "POST", body: JSON.stringify([booking]) });
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
  roomId: number;
  status: string; // "confirmed" to block the dates
  arrival: string;
  departure: string;
  firstName?: string;
  lastName?: string;
  notes?: string;
}

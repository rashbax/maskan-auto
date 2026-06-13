"use client";
// Data-access layer — maps Supabase rows into the shapes the UI consumes
// (same shape as the mock data in data.js, so components don't change).
import { createClient } from "../lib/supabase/client";
import { MASKAN } from "./data";

// Fetch all active apartments with their reviews + availability (busy dates).
export async function getApartments() {
  const sb = createClient();

  const [aptRes, revRes, photoRes] = await Promise.all([
    sb.from("apartments").select("*").eq("status", "active").order("id"),
    sb.from("reviews").select("*").eq("hidden", false).order("created_at", { ascending: false }),
    sb.from("apartment_photos").select("apartment_id,url,sort,is_cover"),
  ]);
  if (aptRes.error) throw aptRes.error;

  const photosByApt = {};
  (photoRes.data || []).forEach((p) => { (photosByApt[p.apartment_id] ||= []).push(p); });

  // availability via security-definer RPC (graceful: works even before 0002 is applied)
  const busyByApt = {};
  try {
    const { data: busy } = await sb.rpc("busy_dates");
    (busy || []).forEach((r) => {
      (busyByApt[r.apartment_id] ||= new Set()).add(r.d);
    });
  } catch {
    /* RPC not present yet — leave all days free */
  }

  const reviewsByApt = {};
  (revRes.data || []).forEach((r) => {
    (reviewsByApt[r.apartment_id] ||= []).push({
      name: r.name,
      country: r.country,
      rating: r.rating,
      date: (r.created_at || "").slice(0, 10),
      cons: r.cons || "",
      text: r.text || "",
      hostReply: r.host_reply || "",
      hidden: r.hidden,
    });
  });

  return (aptRes.data || []).map((a) => ({
    id: a.id,
    tone: a.tone,
    price: a.price_usd,
    district: a.district,
    sleeps: a.sleeps,
    beds: a.beds,
    livingRooms: a.living_rooms ?? 0,
    baths: a.baths,
    size: a.size_m2,
    rating: Number(a.rating) || 0,
    reviews: a.reviews_count || 0,
    photos: a.photos_count || 0,
    host: a.host || "Maskan",
    superhost: !!a.superhost,
    near: a.near || { uz: "", ru: "", en: "" },
    title: a.title || { uz: "", ru: "", en: "" },
    blurb: a.blurb || { uz: "", ru: "", en: "" },
    amenities: a.amenities || [],
    lat: a.lat != null ? Number(a.lat) : undefined,
    lng: a.lng != null ? Number(a.lng) : undefined,
    photoUrls: (photosByApt[a.id] || [])
      .slice()
      .sort((x, y) => (y.is_cover ? 1 : 0) - (x.is_cover ? 1 : 0) || x.sort - y.sort)
      .map((p) => p.url),
    busy: busyByApt[a.id] || new Set(),
    reviewsList: reviewsByApt[a.id] || [],
  }));
}

// ---------- admin: photo upload (presigned R2) ----------
export async function requestUploadUrl(apartmentId, contentType) {
  const res = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apartmentId, contentType }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || "upload_url_failed");
  }
  return res.json(); // { url, publicUrl }
}

export async function addPhoto(apartmentId, url, sort, isCover) {
  const sb = createClient();
  await sb.from("apartment_photos").insert({ apartment_id: apartmentId, url, sort: sort || 0, is_cover: !!isCover });
}

export async function getPhotos(apartmentId) {
  const sb = createClient();
  const { data } = await sb.from("apartment_photos").select("*").eq("apartment_id", apartmentId).order("sort");
  return data || [];
}

export async function deletePhoto(id) {
  const sb = createClient();
  await sb.from("apartment_photos").delete().eq("id", id);
}

// persist a new photo order — items: [{ id, sort, is_cover }] (first = cover)
export async function setPhotoOrder(items) {
  const sb = createClient();
  await Promise.all(
    items.map((it) => sb.from("apartment_photos").update({ sort: it.sort, is_cover: !!it.is_cover }).eq("id", it.id))
  );
}

// Create an instant booking via the trusted server route. The server derives price/nights and
// checks availability (direct client inserts are blocked by RLS). Access codes are NOT auto-sent
// — the host contacts the guest (via the contact left here) to hand over keys at check-in.
export async function createBooking({ apartmentId, guestName, phone, telegram, messenger, adults, children, from, to }) {
  const sb = createClient();
  const { data: { session } } = await sb.auth.getSession(); // link to the account if signed in
  const res = await fetch("/api/book", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({
      apartmentId,
      from: MASKAN.iso(from),
      to: MASKAN.iso(to),
      guestName,
      phone,
      telegram,
      messenger,
      adults,
      children,
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "booking_failed");
  return j.id;
}

// ---------- favorites (signed-in users; RLS = own rows) ----------
export async function getFavorites() {
  const sb = createClient();
  const { data, error } = await sb.from("favorites").select("apartment_id");
  if (error) return new Set();
  return new Set((data || []).map((r) => r.apartment_id));
}

export async function addFavorite(apartmentId) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  await sb.from("favorites").insert({ user_id: user.id, apartment_id: apartmentId });
}

export async function removeFavorite(apartmentId) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  await sb.from("favorites").delete().eq("user_id", user.id).eq("apartment_id", apartmentId);
}

// ---------- this user's bookings (RLS = own rows) ----------
export async function getMyBookings() {
  const sb = createClient();
  const { data, error } = await sb.from("bookings").select("*").order("checkin", { ascending: false });
  if (error) return [];
  return (data || []).map((b) => ({
    id: b.id,
    apt: b.apartment_id,
    from: b.checkin,
    to: b.checkout,
    nights: b.nights,
    usd: b.total_usd,
    status: b.status === "checked-out" ? "past" : b.status,
  }));
}

// ---------- admin: all bookings (RLS lets an admin read every row) ----------
export async function getAllBookings() {
  const sb = createClient();
  const { data, error } = await sb.from("bookings").select("*").order("checkin", { ascending: true });
  if (error) return [];
  return (data || []).map((b) => ({
    id: b.id,
    apt: b.apartment_id,
    guest: b.guest_name,
    phone: b.phone,
    tg: b.telegram,
    from: b.checkin,
    to: b.checkout,
    nights: b.nights,
    total: b.total_usd,
    source: b.source,
    status: b.status,
  }));
}

export async function cancelBooking(id) {
  const sb = createClient();
  const { error } = await sb.from("bookings").update({ status: "cancelled" }).eq("id", id);
  return !error;
}

// admin records an external booking (verbal / OLX / Booking.com) — counts toward revenue
export async function createManualBooking({ apartmentId, guestName, phone, from, to, total, source }) {
  const sb = createClient();
  const nights = Math.round((new Date(to) - new Date(from)) / 86400000);
  const id = "BK-M-" + Date.now().toString().slice(-7);
  const { error } = await sb.from("bookings").insert({
    id,
    apartment_id: apartmentId,
    guest_name: guestName || null,
    phone: phone || null,
    checkin: from,
    checkout: to,
    nights,
    total_usd: total ?? null,
    source: source || "manual",
    status: "active",
  });
  if (error) throw error;
  return id;
}

// ---------- current user's role (guest | admin) ----------
export async function getMyRole() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from("profiles").select("role").eq("id", user.id).single();
  return data?.role || "guest";
}

// ---------- admin: manual availability blocks ----------
export async function getBlocks(apartmentId) {
  const sb = createClient();
  const { data, error } = await sb.from("availability_blocks").select("date").eq("apartment_id", apartmentId);
  if (error) return new Set();
  return new Set((data || []).map((r) => r.date));
}
export async function blockDay(apartmentId, date) {
  const sb = createClient();
  // throws (e.g. 23B01) when the day already has an active booking — caller rolls back the UI
  const { error } = await sb.from("availability_blocks").insert({ apartment_id: apartmentId, date });
  if (error) throw error;
}
export async function unblockDay(apartmentId, date) {
  const sb = createClient();
  const { error } = await sb.from("availability_blocks").delete().eq("apartment_id", apartmentId).eq("date", date);
  if (error) throw error;
}

// ---------- admin: review moderation (admin sees hidden too via RLS) ----------
export async function getAllReviews() {
  const sb = createClient();
  const { data, error } = await sb.from("reviews").select("*").order("created_at", { ascending: false });
  if (error) return [];
  return data || [];
}
export async function setReviewHidden(id, hidden, reason) {
  const sb = createClient();
  await sb.from("reviews").update({ hidden }).eq("id", id);
  await sb.from("review_audit").insert({ review_id: id, action: hidden ? "hide" : "unhide", reason: reason || null, who: "admin" });
}
export async function setReviewReply(id, reply) {
  const sb = createClient();
  await sb.from("reviews").update({ host_reply: reply }).eq("id", id);
  await sb.from("review_audit").insert({ review_id: id, action: "reply", who: "admin" });
}

// ---------- guest: submit a review (RLS allows only post-stay guests) ----------
export async function submitReview({ apartmentId, rating, cons, text, name, country }) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "not_logged_in" };
  const { error } = await sb.from("reviews").insert({
    apartment_id: apartmentId,
    user_id: user.id,
    name: name || "Mehmon",
    country: country || "",
    rating,
    cons: cons || "",
    text: text || "",
  });
  if (error) {
    const rls = error.code === "42501" || /row-level/i.test(error.message || "");
    return { error: rls ? "not_eligible" : "fail" };
  }
  return { ok: true };
}

// ---------- admin: create / update an apartment (text fields) ----------
export async function saveApartment(row, address) {
  const sb = createClient();
  const { error } = await sb.from("apartments").upsert(row);
  if (error) throw error;
  if (address != null && address !== "") {
    await sb.from("apartment_private").upsert({ apartment_id: row.id, address });
  }
  return row.id;
}

export async function deleteApartment(id) {
  const sb = createClient();
  const { error } = await sb.from("apartments").delete().eq("id", id);
  if (error) throw error;
}

"use client";
// Data-access layer — maps Supabase rows into the shapes the UI consumes
// (same shape as the mock data in data.js, so components don't change).
import { createClient } from "../lib/supabase/client";
import { MASKAN } from "./data";

// Fetch all active apartments with their reviews + availability (busy dates).
export async function getApartments() {
  const sb = createClient();

  const [aptRes, revRes] = await Promise.all([
    sb.from("apartments").select("*").eq("status", "active").order("id"),
    sb.from("reviews").select("*").eq("hidden", false).order("created_at", { ascending: false }),
  ]);
  if (aptRes.error) throw aptRes.error;

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
    baths: a.baths,
    size: a.size_m2,
    rating: Number(a.rating),
    reviews: a.reviews_count,
    photos: a.photos_count,
    host: a.host,
    superhost: a.superhost,
    near: a.near,
    title: a.title,
    blurb: a.blurb,
    amenities: a.amenities || [],
    lat: a.lat != null ? Number(a.lat) : undefined,
    lng: a.lng != null ? Number(a.lng) : undefined,
    busy: busyByApt[a.id] || new Set(),
    reviewsList: reviewsByApt[a.id] || [],
  }));
}

// Create an instant booking. Access codes are NOT auto-sent — the host contacts
// the guest (via the contact left here) to hand over keys at check-in.
export async function createBooking({ apartmentId, guestName, phone, telegram, messenger, from, to, price }) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  const checkin = MASKAN.iso(from);
  const checkout = MASKAN.iso(to);
  const nights = Math.round((to - from) / 86400000);
  const id = "BK-" + Date.now().toString().slice(-7);

  const { error } = await sb.from("bookings").insert({
    id,
    apartment_id: apartmentId,
    user_id: user?.id ?? null, // link to the account if signed in
    guest_name: guestName || null,
    phone: phone || null,
    telegram: telegram || null,
    messenger: messenger || "telegram",
    checkin,
    checkout,
    nights,
    total_usd: price ? price * nights : null,
    source: "website",
    status: "active",
  });
  if (error) throw error;
  return id;
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
  await sb.from("availability_blocks").insert({ apartment_id: apartmentId, date });
}
export async function unblockDay(apartmentId, date) {
  const sb = createClient();
  await sb.from("availability_blocks").delete().eq("apartment_id", apartmentId).eq("date", date);
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

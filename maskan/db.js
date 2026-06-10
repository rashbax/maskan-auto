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
  const checkin = MASKAN.iso(from);
  const checkout = MASKAN.iso(to);
  const nights = Math.round((to - from) / 86400000);
  const id = "BK-" + Date.now().toString().slice(-7);

  const { error } = await sb.from("bookings").insert({
    id,
    apartment_id: apartmentId,
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

import { createClient } from "@/lib/supabase/server";

// Full apartment for the server-rendered detail page (content the crawlers must see).
export async function getApartmentFull(id: string) {
  const sb = await createClient();
  const { data: a } = await sb.from("apartments").select("*").eq("id", id).eq("status", "active").single();
  if (!a) return null;

  const [{ data: photos }, { data: reviews }] = await Promise.all([
    sb.from("apartment_photos").select("url,sort,is_cover").eq("apartment_id", id),
    sb.from("reviews").select("*").eq("apartment_id", id).eq("hidden", false).order("created_at", { ascending: false }),
  ]);

  const photoUrls = (photos || [])
    .slice()
    .sort((x, y) => (y.is_cover ? 1 : 0) - (x.is_cover ? 1 : 0) || x.sort - y.sort)
    .map((p) => p.url as string);

  return {
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
    host: a.host || "Maskan",
    superhost: !!a.superhost,
    near: a.near || { uz: "", ru: "", en: "" },
    title: a.title || { uz: "", ru: "", en: "" },
    blurb: a.blurb || { uz: "", ru: "", en: "" },
    amenities: a.amenities || [],
    lat: a.lat != null ? Number(a.lat) : undefined,
    lng: a.lng != null ? Number(a.lng) : undefined,
    photos: a.photos_count || photoUrls.length || 0,
    photoUrls,
    reviewsList: (reviews || []).map((r) => ({
      name: r.name, country: r.country, rating: r.rating,
      date: (r.created_at || "").slice(0, 10), cons: r.cons || "", text: r.text || "", hostReply: r.host_reply || "",
    })),
  };
}

// Server-side fetch of one apartment + its cover photo, for SEO metadata / Open Graph.
export async function getApartmentForMeta(id: string) {
  const sb = await createClient();
  const { data: a } = await sb
    .from("apartments")
    .select("id,title,blurb,district,price_usd,sleeps")
    .eq("id", id)
    .eq("status", "active")
    .single();
  if (!a) return null;

  const { data: photo } = await sb
    .from("apartment_photos")
    .select("url")
    .eq("apartment_id", id)
    .order("is_cover", { ascending: false })
    .order("sort")
    .limit(1)
    .maybeSingle();

  return {
    id: a.id,
    title: (a.title || {}) as Record<string, string>,
    blurb: (a.blurb || {}) as Record<string, string>,
    district: a.district as string,
    price: a.price_usd as number,
    sleeps: a.sleeps as number,
    cover: (photo?.url as string | undefined) || null,
  };
}

import { createClient } from "@/lib/supabase/server";

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

import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const BASE = "https://maskan-auto.vercel.app";

export const revalidate = 3600; // refresh the apartment list hourly without a redeploy

// Lists every public apartment URL so Google/Yandex can discover and index them (the catalog
// is client-rendered, so crawlers can't follow its links — the sitemap is how they're found).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let apartments: MetadataRoute.Sitemap = [];
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await sb.from("apartments").select("id").eq("status", "active");
    apartments = (data || []).map((a) => ({
      url: `${BASE}/apartment/${a.id}`,
      changeFrequency: "daily",
      priority: 0.8,
      alternates: {
        languages: {
          uz: `${BASE}/apartment/${a.id}`,
          ru: `${BASE}/ru/apartment/${a.id}`,
          en: `${BASE}/en/apartment/${a.id}`,
        },
      },
    }));
  } catch {
    /* DB unavailable at build — still emit the home URL */
  }
  return [{ url: BASE, changeFrequency: "daily", priority: 1 }, ...apartments];
}

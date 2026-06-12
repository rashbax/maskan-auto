import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MASKAN } from "@/maskan/data";
import { MapView } from "@/maskan/maps";
import { AptReserve } from "@/maskan/apt-reserve";
import { getApartmentForMeta, getApartmentFull } from "@/lib/apartments-server";
import { publicDb } from "@/lib/supabase/public";

type Params = { params: Promise<{ id: string }> };

const pick = (o: Record<string, string> | undefined) => (o?.uz || o?.ru || o?.en || "").trim();

export const revalidate = 3600; // ISR: serve cached HTML, refresh hourly
export const dynamicParams = true; // apartments not prebuilt render on demand, then cache

export async function generateStaticParams() {
  const { data } = await publicDb().from("apartments").select("id").eq("status", "active");
  return (data ?? []).map((a) => ({ id: a.id as string }));
}

// Per-apartment metadata → shareable links (rich preview) + search visibility.
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const apt = await getApartmentForMeta(id);
  if (!apt) return { title: "Maskan — Kunlik kvartiralar, Toshkent" };
  const name = pick(apt.title) || "Kunlik kvartira";
  const title = `${name} — Maskan`;
  const description =
    pick(apt.blurb).replace(/\s+/g, " ").slice(0, 160) ||
    `Toshkentda kunlik kvartira — $${apt.price}/kecha, ${apt.sleeps} kishigacha. Lahzada band qiling.`;
  const images = apt.cover ? [{ url: apt.cover, alt: name }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/apartment/${apt.id}` },
    openGraph: { title, description, images, type: "website", url: `/apartment/${apt.id}` },
    twitter: { card: "summary_large_image", title, description, images: apt.cover ? [apt.cover] : undefined },
  };
}

export default async function ApartmentPage({ params }: Params) {
  const { id } = await params;
  const apt = await getApartmentFull(id);
  if (!apt) notFound();

  const S = MASKAN.STR.uz; // server-rendered content in Uzbek (primary market language)
  const M = MASKAN;
  const name = pick(apt.title);
  const district = (M.DISTRICTS as Record<string, { uz: string }>)[apt.district]?.uz || apt.district;
  const photos: string[] = apt.photoUrls || [];

  // structured data → rich snippets (stars, price) in Google/Yandex
  const ld = {
    "@context": "https://schema.org",
    "@type": "Apartment",
    name,
    image: photos.slice(0, 5),
    numberOfRooms: apt.beds,
    occupancy: { "@type": "QuantitativeValue", maxValue: apt.sleeps },
    address: { "@type": "PostalAddress", addressLocality: "Tashkent", addressRegion: district, addressCountry: "UZ" },
    ...(apt.lat != null && apt.lng != null ? { geo: { "@type": "GeoCoordinates", latitude: apt.lat, longitude: apt.lng } } : {}),
    ...(apt.reviews > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: apt.rating.toFixed(2), reviewCount: apt.reviews } } : {}),
    offers: { "@type": "Offer", price: apt.price, priceCurrency: "USD", availability: "https://schema.org/InStock" },
  };

  return (
    <div className="min-h-screen bg-canvas">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <header className="sticky top-0 z-30 bg-canvas/90 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="font-serif text-[18px] font-semibold">Maskan</Link>
          <Link href="/" className="text-[13.5px] font-semibold text-inksoft hover:text-ink">← Katalog</Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
        {/* photos (server-rendered <img> — crawler-visible) */}
        {photos.length > 0 ? (
          <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[280px] md:h-[420px] rounded-3xl overflow-hidden mb-7">
            <div className="col-span-2 row-span-2 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photos[0]} alt={name} className="w-full h-full object-cover" />
            </div>
            {photos.slice(1, 5).map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={u} alt={`${name} — rasm ${i + 2}`} loading="lazy" className="w-full h-full object-cover" />
            ))}
          </div>
        ) : (
          <div className="h-[240px] rounded-3xl bg-cream border border-line grid place-items-center text-inksoft mb-7">Rasm hali yo‘q</div>
        )}

        <div className="grid lg:grid-cols-[1fr_360px] gap-10">
          {/* ===== content (SSR) ===== */}
          <div>
            <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-green-700">{district} · {S.search_city}</span>
            <h1 className="font-serif text-[28px] md:text-[34px] leading-[1.12] mt-1.5" style={{ textWrap: "balance" }}>{name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 text-[14px] text-inksoft font-medium">
              <span>★ {apt.rating.toFixed(2)} ({apt.reviews})</span>
              <span>· {S.sleeps(apt.sleeps)}</span>
              <span>· {apt.beds} yotoqxona</span>
              {apt.livingRooms > 0 && <span>· {apt.livingRooms} mehmonxona</span>}
              <span>· {apt.baths} hammom</span>
              <span>· {apt.size} m²</span>
            </div>

            <div className="mt-6 pt-6 border-t border-line flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-700 text-cream grid place-items-center font-serif text-[18px]">{(apt.host || "M")[0]}</div>
              <div><div className="text-[15px] font-bold">{apt.host}</div><div className="text-[12.5px] text-inksoft">{S.response}</div></div>
            </div>

            {pick(apt.blurb) && (
              <section className="mt-6 pt-6 border-t border-line">
                <p className="text-[15px] leading-relaxed text-ink/85 whitespace-pre-line">{pick(apt.blurb)}</p>
              </section>
            )}

            {apt.amenities.length > 0 && (
              <section className="mt-6 pt-6 border-t border-line">
                <h2 className="font-serif text-[20px] mb-3">{S.amenities}</h2>
                <div className="flex flex-wrap gap-2">
                  {apt.amenities.map((a: string) => (
                    <span key={a} className="inline-flex items-center h-9 px-3.5 rounded-full bg-white border border-line text-[13.5px] font-medium">
                      {(M.AMENITIES as Record<string, { uz: string }>)[a]?.uz || a}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-6 pt-6 border-t border-line">
              <h2 className="font-serif text-[20px] mb-3">{S.house_rules}</h2>
              <div className="grid grid-cols-2 gap-4 text-[14px]">
                <div><b>{S.checkin}</b> · 14:00</div>
                <div><b>{S.checkout}</b> · 12:00</div>
              </div>
            </section>

            <section className="mt-6 pt-6 border-t border-line">
              <h2 className="font-serif text-[20px] mb-3">{S.where}</h2>
              {apt.lat != null && apt.lng != null
                ? <MapView lat={apt.lat} lng={apt.lng} label={name} lang="uz" />
                : <div className="h-44 rounded-2xl border border-line bg-cream grid place-items-center text-inksoft text-[13px]">{district} · {S.search_city}</div>}
              <p className="text-[13px] text-green-900 bg-green-50 rounded-xl p-3.5 mt-3">Bino xaritada koʻrsatilgan. Kvartira raqami (qavat / kirish) bron qilingach yuboriladi.</p>
            </section>

            {apt.reviewsList.length > 0 && (
              <section className="mt-6 pt-6 border-t border-line">
                <h2 className="font-serif text-[20px] mb-4">{S.reviews_title} · {apt.rating.toFixed(2)}</h2>
                <div className="space-y-4">
                  {apt.reviewsList.slice(0, 6).map((r, i) => (
                    <div key={i} className="rounded-2xl border border-line bg-white p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[14px]">{r.name}{r.country ? ` · ${r.country}` : ""}</span>
                        <span className="text-[13px] text-inksoft">★ {r.rating} · {r.date}</span>
                      </div>
                      {r.text && <p className="text-[14px] text-ink/85 mt-1.5 leading-relaxed">{r.text}</p>}
                      {r.hostReply && <p className="text-[13px] text-inksoft mt-2 pl-3 border-l-2 border-line">{apt.host}: {r.hostReply}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ===== reserve island (client) ===== */}
          <aside className="lg:sticky lg:top-20 self-start">
            <AptReserve apt={apt} />
          </aside>
        </div>
      </div>
    </div>
  );
}

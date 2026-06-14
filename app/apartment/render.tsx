import type { Metadata } from "next";
import Link from "next/link";
import { MASKAN } from "@/maskan/data";
import { MapView } from "@/maskan/maps";
import { AptReserve } from "@/maskan/apt-reserve";
import { Gallery } from "@/maskan/gallery";
import { SaveButton, ReviewWidget } from "@/maskan/apt-actions";
import { Description } from "@/maskan/description";

export type Locale = "uz" | "ru" | "en";
export const LOCALES: Locale[] = ["uz", "ru", "en"];
const BASE = "https://maskan-auto.vercel.app";

// normalise CRLF/CR → LF so whitespace-pre-line renders the same across browsers (Yandex/Chromium
// can otherwise show a stray carriage return as a broken line break / extra space).
const pickL = (o: Record<string, string> | undefined, l: Locale) => (o?.[l] || o?.uz || o?.ru || o?.en || "").replace(/\r\n?/g, "\n").trim();

const T = {
  catalog: { uz: "Katalog", ru: "Каталог", en: "Catalog" },
  noPhoto: { uz: "Rasm hali yoʻq", ru: "Фото пока нет", en: "No photos yet" },
  beds: { uz: "yotoqxona", ru: "спальня", en: "bedroom" },
  living: { uz: "mehmonxona", ru: "гостиная", en: "living room" },
  baths: { uz: "hammom", ru: "санузел", en: "bathroom" },
  locNote: {
    uz: "Bino xaritada koʻrsatilgan. Kvartira raqami (qavat / kirish) bron qilingach yuboriladi.",
    ru: "Здание показано на карте. Номер квартиры (этаж / подъезд) отправим после бронирования.",
    en: "The building is shown on the map. The apartment number (floor / entrance) is sent after you book.",
  },
  waText: {
    uz: "Salom! Ushbu kvartira boʻyicha soʻramoqchiman:",
    ru: "Здравствуйте! Хочу узнать об этой квартире:",
    en: "Hello! I'd like to ask about this apartment:",
  },
  descFallback: (price: number, sleeps: number) => ({
    uz: `Toshkentda kunlik kvartira — $${price}/kecha, ${sleeps} kishigacha. Lahzada band qiling.`,
    ru: `Посуточная квартира в Ташкенте — $${price}/ночь, до ${sleeps} гостей. Мгновенное бронирование.`,
    en: `Daily apartment in Tashkent — $${price}/night, up to ${sleeps} guests. Instant booking.`,
  }),
};

// uz lives at /apartment/<id>; ru/en are prefixed. hreflang ties the three together.
export const aptUrl = (id: string, l: Locale) => (l === "uz" ? `${BASE}/apartment/${id}` : `${BASE}/${l}/apartment/${id}`);

type MetaApt = { id: string; title: Record<string, string>; blurb: Record<string, string>; price: number; sleeps: number; cover: string | null };

export function apartmentMetadata(apt: MetaApt, locale: Locale): Metadata {
  const name = pickL(apt.title, locale) || "Kunlik kvartira";
  const title = `${name} — Maskan`;
  const description = pickL(apt.blurb, locale).replace(/\s+/g, " ").slice(0, 160) || T.descFallback(apt.price, apt.sleeps)[locale];
  const images = apt.cover ? [{ url: apt.cover, alt: name }] : undefined;
  return {
    title,
    description,
    alternates: {
      canonical: aptUrl(apt.id, locale),
      languages: { uz: aptUrl(apt.id, "uz"), ru: aptUrl(apt.id, "ru"), en: aptUrl(apt.id, "en"), "x-default": aptUrl(apt.id, "uz") },
    },
    openGraph: { title, description, images, type: "website", url: aptUrl(apt.id, locale) },
    twitter: { card: "summary_large_image", title, description, images: apt.cover ? [apt.cover] : undefined },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ApartmentView({ apt, locale }: { apt: any; locale: Locale }) {
  const S = MASKAN.STR[locale];
  const M = MASKAN;
  const name = pickL(apt.title, locale);
  const districts = M.DISTRICTS as unknown as Record<string, Record<Locale, string>>;
  const district = districts[apt.district]?.[locale] || apt.district;
  const photos: string[] = apt.photoUrls || [];
  // The catalog SPA only exists at the root; /ru and /en are not routes (they 404).
  // It restores the chosen language from localStorage, so "/" is correct for every locale.
  const home = "/";

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <header className="sticky top-0 z-30 bg-canvas/90 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center gap-2.5">
          <Link href={home} aria-label={T.catalog[locale]} className="inline-flex items-center gap-1.5 -ml-1 pr-2 h-9 rounded-full text-[14px] font-semibold hover:opacity-70">
            <span className="w-9 h-9 grid place-items-center rounded-full hover:bg-black/5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </span>
            {T.catalog[locale]}
          </Link>
          <span className="ml-auto font-serif text-[18px] font-semibold">Maskan</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-6 pb-28 lg:pb-6">
        {photos.length > 0 ? (
          <Gallery photos={photos} name={name} />
        ) : (
          <div className="h-[240px] rounded-3xl bg-cream border border-line grid place-items-center text-inksoft mb-7">{T.noPhoto[locale]}</div>
        )}

        <div className="grid lg:grid-cols-[1fr_360px] gap-10">
          <div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-green-700 pt-1.5">{district} · {S.search_city}</span>
              <SaveButton aptId={apt.id} lang={locale} />
            </div>
            <h1 className="font-serif text-[28px] md:text-[34px] leading-[1.12] mt-1.5" style={{ textWrap: "balance" }}>{name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 text-[14px] text-inksoft font-medium">
              <span>★ {apt.rating.toFixed(2)} ({apt.reviews})</span>
              <span>· {S.sleeps(apt.sleeps)}</span>
              <span>· {apt.beds} {T.beds[locale]}</span>
              {apt.livingRooms > 0 && <span>· {apt.livingRooms} {T.living[locale]}</span>}
              <span>· {apt.baths} {T.baths[locale]}</span>
              <span>· {apt.size} m²</span>
            </div>

            <div className="mt-6 pt-6 border-t border-line flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-700 text-cream grid place-items-center font-serif text-[18px]">{(apt.host || "M")[0]}</div>
              <div><div className="text-[15px] font-bold">{apt.host}</div><div className="text-[12.5px] text-inksoft">{S.response}</div></div>
            </div>

            {pickL(apt.blurb, locale) && (
              <section className="mt-6 pt-6 border-t border-line">
                <Description text={pickL(apt.blurb, locale)} lang={locale} />
              </section>
            )}

            {apt.amenities.length > 0 && (
              <section className="mt-6 pt-6 border-t border-line">
                <h2 className="font-serif text-[20px] mb-3">{S.amenities}</h2>
                <div className="flex flex-wrap gap-2">
                  {apt.amenities.map((a: string) => (
                    <span key={a} className="inline-flex items-center h-9 px-3.5 rounded-full bg-white border border-line text-[13.5px] font-medium">
                      {(M.AMENITIES as unknown as Record<string, Record<Locale, string>>)[a]?.[locale] || a}
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
                ? <MapView lat={apt.lat} lng={apt.lng} label={name} lang={locale} />
                : <div className="h-44 rounded-2xl border border-line bg-cream grid place-items-center text-inksoft text-[13px]">{district} · {S.search_city}</div>}
              <p className="text-[13px] text-green-900 bg-green-50 rounded-xl p-3.5 mt-3">{T.locNote[locale]}</p>
            </section>

            <section className="mt-6 pt-6 border-t border-line">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <h2 className="font-serif text-[20px]">{S.reviews_title}{apt.reviews > 0 ? ` · ${apt.rating.toFixed(2)}` : ""}</h2>
                <ReviewWidget aptId={apt.id} lang={locale} />
              </div>
              {apt.reviewsList.length > 0 ? (
                <div className="space-y-4">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {apt.reviewsList.slice(0, 6).map((r: any, i: number) => (
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
              ) : (
                <p className="text-[14px] text-inksoft">{locale === "ru" ? "Пока нет отзывов — оставьте первый." : locale === "en" ? "No reviews yet — be the first." : "Hali sharh yoʻq — birinchi boʻling."}</p>
              )}
            </section>

            <section className="mt-6 pt-6 border-t border-line">
              <h2 className="font-serif text-[20px] mb-1">{S.questions_title}</h2>
              <p className="text-[13.5px] text-inksoft mb-4">{S.questions_sub}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a href={`https://wa.me/${M.CONTACT.wa}?text=${encodeURIComponent(`${T.waText[locale]} ${name} — ${aptUrl(apt.id, locale)}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-full bg-white border border-line font-semibold text-[14.5px] hover:border-ink/30">WhatsApp</a>
                <a href={`https://t.me/${M.CONTACT.bot}?start=${apt.id}_${locale}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-full bg-green-700 text-cream font-semibold text-[14.5px] hover:bg-green-900">Telegram</a>
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-20 self-start">
            <AptReserve apt={apt} lang={locale} />
          </aside>
        </div>
      </div>
    </div>
  );
}

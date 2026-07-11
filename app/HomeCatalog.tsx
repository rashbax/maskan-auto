import { MASKAN } from "@/maskan/data";
import { WEBSITE_DISCOUNT_PCT } from "@/lib/pricing";
import type { HomeApartment } from "@/lib/apartments-server";

// Server-rendered home catalog — the content crawlers index and the user's instant first paint.
// Russian-first (the SPA's first-visit default, so the swap keeps language parity) with an Uzbek
// line for uz searchers. The SPA (AppClient) replaces this once its own data is ready.
// Cards link to the /ru apartment pages so a pre-hydration click stays in the same language.

const D = MASKAN.DISTRICTS as unknown as Record<string, { ru: string; uz: string; en: string }>;

export function HomeCatalog({ apartments }: { apartments: HomeApartment[] }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <span className="font-serif text-[19px] font-semibold">Maskan</span>
          <span className="text-[13px] text-inksoft">Ташкент · Toshkent</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8 pb-16">
        <h1 className="font-serif text-[28px] md:text-[36px] leading-[1.15]" style={{ textWrap: "balance" }}>
          Квартиры посуточно в Ташкенте — реальные фото, мгновенное бронирование
        </h1>
        <p className="mt-2.5 text-[15px] text-inksoft max-w-3xl">
          Toshkentda kunlik ijara kvartiralar — real suratlar, halol narx, onlayn bron.
          Скидка −{WEBSITE_DISCOUNT_PCT}% при бронировании на сайте.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {apartments.map((a) => {
            const name = a.title.ru || a.title.uz || `Квартира ${a.id}`;
            const district = D[a.district]?.ru || a.district;
            return (
              <a key={a.id} href={`/ru/apartment/${a.id}`} className="group rounded-3xl overflow-hidden border border-line bg-white transition hover:shadow-lg">
                {a.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.cover} alt={name} loading="lazy" className="w-full aspect-[4/3] object-cover" />
                ) : (
                  <div className="w-full aspect-[4/3] bg-cream" />
                )}
                <div className="p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-green-700">{district} · Ташкент</div>
                  <h2 className="font-serif text-[17.5px] leading-snug mt-1">{name}</h2>
                  <div className="mt-1.5 text-[13.5px] text-inksoft">
                    до {a.sleeps} гостей · {a.beds} спальня{a.reviews > 0 ? ` · ★ ${a.rating.toFixed(2)} (${a.reviews})` : ""}
                  </div>
                  <div className="mt-2 text-[15.5px] font-bold">
                    ${a.price} <span className="font-medium text-inksoft text-[13.5px]">/ сутки</span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        <section className="mt-12 max-w-3xl text-[13.5px] text-inksoft leading-relaxed space-y-2">
          <h2 className="font-serif text-[19px] text-ink">Посуточная аренда квартир в Ташкенте — без звонков</h2>
          <p>
            Maskan — сервис посуточной аренды в Ташкенте: Юнусабад, Яккасарай, Мирабад и другие районы.
            Все фото настоящие, календарь показывает реальную занятость, бронирование подтверждается мгновенно —
            без звонков и предоплаты. Ключи и адрес хозяин отправляет сразу после брони.
          </p>
          <p>
            Maskan — Toshkentda kunlik kvartira ijarasi: real suratlar, jonli band/boʻsh kalendar va lahzali onlayn bron.
            Saytdan bron qilsangiz narx OTA'lardagidan −{WEBSITE_DISCOUNT_PCT}% arzon.
          </p>
        </section>
      </main>
    </div>
  );
}

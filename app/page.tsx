import type { Metadata } from "next";
import AppClient from "./AppClient";
import { HomeCatalog } from "./HomeCatalog";
import { getApartmentsForHome } from "@/lib/apartments-server";
import { SITE_URL } from "@/lib/site-url";

// ISR: the server-rendered catalog refreshes hourly, same cadence as the apartment pages.
export const revalidate = 3600;

const TITLE = "Квартиры посуточно в Ташкенте — Maskan | Kunlik kvartiralar";
const DESCRIPTION =
  "Посуточная аренда квартир в Ташкенте: реальные фото, честная цена, мгновенное бронирование онлайн и скидка −10% на сайте. Toshkentda kunlik kvartiralar — onlayn bron.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/`,
    type: "website",
    images: [{ url: `${SITE_URL}/og`, width: 1200, height: 630, alt: "Maskan — квартиры посуточно в Ташкенте" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [`${SITE_URL}/og`] },
};

export default async function Home() {
  const apartments = await getApartmentsForHome();

  const homeJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Maskan",
        url: SITE_URL,
        logo: `${SITE_URL}/maskan-logo.png`,
      },
      {
        "@type": "WebSite",
        name: "Maskan",
        url: SITE_URL,
        inLanguage: ["ru", "uz", "en"],
      },
      {
        "@type": "ItemList",
        name: "Квартиры посуточно в Ташкенте",
        itemListElement: apartments.map((a, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE_URL}/ru/apartment/${a.id}`,
          name: a.title.ru || a.title.uz || a.id,
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd).replace(/</g, "\\u003c") }} />
      <AppClient fallback={<HomeCatalog apartments={apartments} />} />
    </>
  );
}

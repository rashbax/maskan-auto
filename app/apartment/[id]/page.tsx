import type { Metadata } from "next";
import AppClient from "../../AppClient";
import { getApartmentForMeta } from "@/lib/apartments-server";

type Params = { params: Promise<{ id: string }> };

// Per-apartment metadata → shareable links (rich Telegram/Instagram preview) + search visibility.
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const apt = await getApartmentForMeta(id);
  if (!apt) return { title: "Maskan — Kunlik kvartiralar, Toshkent" };

  const name = apt.title.uz || apt.title.ru || apt.title.en || "Kunlik kvartira";
  const title = `${name} — Maskan`;
  const description =
    (apt.blurb.uz || apt.blurb.ru || apt.blurb.en || "").replace(/\s+/g, " ").slice(0, 160) ||
    `Toshkentda kunlik kvartira — $${apt.price}/kecha, ${apt.sleeps} kishigacha. Lahzada band qiling.`;
  const images = apt.cover ? [{ url: apt.cover }] : undefined;

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
  return <AppClient initialAptId={id} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicDb } from "@/lib/supabase/public";
import { getApartmentForMeta, getApartmentFull } from "@/lib/apartments-server";
import { ApartmentView, apartmentMetadata, type Locale } from "@/app/apartment/render";

type Params = { params: Promise<{ locale: string; id: string }> };

const LOCALES = ["ru", "en"]; // uz lives at /apartment/[id]; this segment serves ru/en

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const { data } = await publicDb().from("apartments").select("id").eq("status", "active");
    const ids = (data ?? []).map((a) => a.id as string);
    return LOCALES.flatMap((locale) => ids.map((id) => ({ locale, id })));
  } catch {
    return []; // no DB env (e.g. CI) — pages still render on-demand via ISR
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, id } = await params;
  if (!LOCALES.includes(locale)) return {};
  const apt = await getApartmentForMeta(id);
  if (!apt) return { title: "Maskan" };
  return apartmentMetadata(apt, locale as Locale);
}

export default async function LocaleApartmentPage({ params }: Params) {
  const { locale, id } = await params;
  if (!LOCALES.includes(locale)) notFound();
  const apt = await getApartmentFull(id);
  if (!apt) notFound();
  return <ApartmentView apt={apt} locale={locale as Locale} />;
}

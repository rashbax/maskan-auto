import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicDb } from "@/lib/supabase/public";
import { getApartmentForMeta, getApartmentFull } from "@/lib/apartments-server";
import { ApartmentView, apartmentMetadata } from "@/app/apartment/render";

type Params = { params: Promise<{ id: string }> };

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const { data } = await publicDb().from("apartments").select("id").eq("status", "active");
  return (data ?? []).map((a) => ({ id: a.id as string }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const apt = await getApartmentForMeta(id);
  if (!apt) return { title: "Maskan — Kunlik kvartiralar, Toshkent" };
  return apartmentMetadata(apt, "uz");
}

export default async function ApartmentPage({ params }: Params) {
  const { id } = await params;
  const apt = await getApartmentFull(id);
  if (!apt) notFound();
  return <ApartmentView apt={apt} locale="uz" />;
}

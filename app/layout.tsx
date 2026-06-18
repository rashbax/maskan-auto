import type { Metadata, Viewport } from "next";
import { Manrope, Spectral } from "next/font/google";
import { SITE_URL } from "@/lib/site-url";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const spectral = Spectral({
  variable: "--font-spectral",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Maskan — Квартиры посуточно в Ташкенте",
  description:
    "Реальные фото, честная цена, мгновенное бронирование. Посуточная аренда квартир в Ташкенте — без звонков.",
  openGraph: {
    title: "Maskan — Квартиры посуточно в Ташкенте",
    description: "Реальные фото, честная цена, мгновенное бронирование. Посуточная аренда квартир в Ташкенте.",
    type: "website",
    locale: "ru_RU",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${manrope.variable} ${spectral.variable} antialiased`}>
      <body className="font-sans text-ink antialiased">{children}</body>
    </html>
  );
}

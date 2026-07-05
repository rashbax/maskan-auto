import type { Metadata, Viewport } from "next";
import { Manrope, Spectral } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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

const siteTitle = "Maskan — Квартиры посуточно в Ташкенте";
const siteDescription =
  "Реальные фото, честная цена, мгновенное бронирование. Посуточная аренда квартир в Ташкенте — без звонков.";
const siteImage = "/maskan-logo.png";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: siteTitle,
  description: siteDescription,
  alternates: { canonical: "/" },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: "website",
    url: "/",
    siteName: "Maskan",
    locale: "ru_RU",
    images: [{ url: siteImage, alt: "Maskan" }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [siteImage],
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
      <body className="font-sans text-ink antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}

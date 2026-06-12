import type { Metadata } from "next";
import { Manrope, Spectral } from "next/font/google";
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
  metadataBase: new URL("https://maskan-auto.vercel.app"),
  title: "Maskan — Kunlik kvartiralar, Toshkent",
  description:
    "Haqiqiy rasmlar, halol narx, lahzada band qilish. Toshkentda kunlik kvartiralar — qoʻngʻiroqlarsiz.",
  openGraph: {
    title: "Maskan — Kunlik kvartiralar, Toshkent",
    description: "Haqiqiy rasmlar, halol narx, lahzada band qilish. Toshkentda kunlik kvartiralar.",
    type: "website",
    locale: "uz_UZ",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" className={`${manrope.variable} ${spectral.variable} antialiased`}>
      <body className="font-sans text-ink antialiased">{children}</body>
    </html>
  );
}

import { ImageResponse } from "next/og";

// Branded Open Graph card for the home page (1200×630). Generated once and cached — a config
// route (not the opengraph-image file convention) so it can never shadow the apartment pages'
// own per-listing cover images.
export const revalidate = 86400;

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #14432e 0%, #1d5c3f 100%)",
          color: "#faf3e7",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ fontSize: 118, fontWeight: 700, letterSpacing: -2 }}>Maskan</div>
        <div style={{ fontSize: 40, marginTop: 10, color: "#ead9bf" }}>Квартиры посуточно в Ташкенте</div>
        <div style={{ fontSize: 27, marginTop: 30, color: "#a8c3b2" }}>
          Реальные фото · Мгновенное бронирование · −10% на сайте
        </div>
        <div style={{ fontSize: 25, marginTop: 8, color: "#7fa38e" }}>maskan-24.uz</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {default:"三浦市ウォーキングラリー",template:"%s | 三浦市ウォーキングラリー"},
  description:
    "三浦市の公開コースを選び、地点順・歩行の目安とコマ地図を確認できます。",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}

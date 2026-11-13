import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "./globals.css";
import "./experience.css";
import "./coastal-theme.css";
import "./walk-design.css";
import "./course-landmarks.css";
import "./home-phone.css";
import "./home-scene.css";
import "./home-design.css";

export const metadata: Metadata = {
  title: {default:"三浦市ウォーキングラリー",template:"%s | 三浦市ウォーキングラリー"},
  description:
    "道のかたちと目印を頼りに、ひとコマずつ三浦を探検。コマ地図で楽しむウォーキングラリー。",
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

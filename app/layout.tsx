import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://ruta-clara-visitas.arianjpl.chatgpt.site"),
  title: "Ruta Clara — Seguimiento de visitas",
  description: "Agenda y seguimiento en vivo para visitas técnicas.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Ruta Clara",
    description: "Seguimiento de visitas, sin llamadas de más.",
    images: [{ url: "/og.png", width: 1733, height: 909, alt: "Ruta Clara — seguimiento de visitas" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}

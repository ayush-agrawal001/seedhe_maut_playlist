import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { DESCRIPTION, KEYWORDS, SITE } from "@/lib/seo";
import SiteJsonLd from "@/components/SiteJsonLd";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Seedhe Maut Player — Listen to Seedhe Maut Online, Free",
    template: "%s · Seedhe Maut Player",
  },
  description: DESCRIPTION,
  keywords: [...KEYWORDS],
  applicationName: SITE.name,
  authors: [{ name: "Ayush Agrawal", url: "https://x.com/bunnyTheRobo001" }],
  creator: "Ayush Agrawal",
  category: "music",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: SITE.locale,
    url: SITE.url,
    title: "Seedhe Maut Player — a full-screen radio that plays only Seedhe Maut",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    creator: "@bunnyTheRobo001",
    title: "Seedhe Maut Player — plays only Seedhe Maut",
    description:
      "Hit play and get a random Seedhe Maut track, full screen, no feed and no algorithm.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // Paste the token from Google Search Console here once the property is added.
  // verification: { google: "…" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050506",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Warm up the third-party origins the player depends on. */}
        <link rel="preconnect" href="https://www.youtube-nocookie.com" />
        <link rel="preconnect" href="https://i.ytimg.com" />
        <link rel="preconnect" href="https://i.scdn.co" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
      </head>
      <body>
        <SiteJsonLd />
        {children}
      </body>
    </html>
  );
}

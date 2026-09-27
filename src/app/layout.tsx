import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { FCMProvider } from "@/hooks/useFCM";
import { AlertProvider } from "@/components/AlertProvider";
import Script from "next/script";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NEED",
  description: "Find trusted local professionals.",
  manifest: "/manifest.json",
  themeColor: "#FFD700",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NEED",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
};

import GlobalNotificationListener from "@/components/GlobalNotificationListener";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossOrigin="" />
        <Script
          id="google-adsense"
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4445454590724783"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AlertProvider>
          <FCMProvider>{children}</FCMProvider>
          <GlobalNotificationListener />
        </AlertProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

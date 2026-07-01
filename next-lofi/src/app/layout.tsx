import type { Metadata } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import { Outfit, Share_Tech_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["200", "300", "400", "600"]
});

const shareTechMono = Share_Tech_Mono({
  variable: "--font-share-tech-mono",
  subsets: ["latin"],
  weight: "400"
});

export const metadata: Metadata = {
  title: "Orbital Lofi Station — Live ISS Tracker & Space Ambient",
  description: "Experience real-time NASA ISS external camera streams and space telemetry. Relax with ambient lofi beats.",
  keywords: "lofi space, live ISS, space station tracker, NASA live stream, space ambient music, space.raondr.com",
  openGraph: {
    type: "website",
    url: "https://space.raondr.com",
    title: "Orbital Lofi Station — Live ISS Tracker & Space Ambient",
    description: "Experience real-time NASA ISS external camera streams and space telemetry. Relax with ambient lofi beats.",
    images: ["https://space.raondr.com/assets/nasa/space_galaxy_1782689382007.png"]
  },
  twitter: {
    card: "summary_large_image",
    title: "Orbital Lofi Station — Live ISS Tracker & Space Ambient",
    description: "Live NASA ISS camera stream and space telemetry with ambient lofi beats.",
    images: ["https://space.raondr.com/assets/nasa/space_galaxy_1782689382007.png"]
  }
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const lang = headersList.get('x-locale') || 'en';

  return (
    <html
      lang={lang}
      className={`${outfit.variable} ${shareTechMono.variable} h-full antialiased`}
    >
      <head>
        <Script
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=G-DW9FLHDRZ0`}
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-DW9FLHDRZ0');
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-black overflow-hidden m-0">{children}</body>
    </html>
  );
}

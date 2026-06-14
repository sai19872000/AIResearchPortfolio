import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const SITE_URL = "https://saiteja.ai";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Sai Teja Pusuluri — generative AI, built to ship",
    template: "%s — Sai Teja Pusuluri",
  },
  description:
    "Dr. Sai Teja Pusuluri — PhD physicist building generative and agentic AI systems that hold up in production. Notes on AI, research, and the engineering behind it.",
  authors: [{ name: "Sai Teja Pusuluri", url: SITE_URL }],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "saiteja.ai",
    title: "Sai Teja Pusuluri — generative AI, built to ship",
    description:
      "PhD physicist building generative and agentic AI systems that hold up in production.",
    images: ["/art/og.png"],
  },
  twitter: { card: "summary_large_image", creator: "@sai19872000", images: ["/art/og.png"] },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${hanken.variable} ${jetbrains.variable} antialiased`}
    >
      <body className="auracle-ambient min-h-screen flex flex-col">
        <div className="auracle-grain" aria-hidden />
        {children}
      </body>
    </html>
  );
}

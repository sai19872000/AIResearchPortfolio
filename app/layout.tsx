import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuraSignature } from "@/components/aura/aura-signature";
import { SiteNav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const SITE_URL = "https://saiteja.ai";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Sai Teja Pusuluri — generative AI, quietly forged",
    template: "%s — Sai Teja Pusuluri",
  },
  description:
    "Dr. Sai Teja Pusuluri — PhD physicist building generative and agentic AI systems that hold up in production. Writing on AI, research, and the work.",
  authors: [{ name: "Sai Teja Pusuluri", url: SITE_URL }],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "saiteja.ai",
    title: "Sai Teja Pusuluri — generative AI, quietly forged",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="field" aria-hidden />
        <AuraSignature />
        <SiteNav />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone server bundle for a small Cloud Run container.
  output: "standalone",
  // Firestore Admin SDK is a Node library with native/dynamic deps — keep it
  // external rather than bundling it into the server build.
  serverExternalPackages: ["@google-cloud/firestore"],
  // No X-Powered-By fingerprint.
  poweredByHeader: false,
  // The site uses plain <img> (art is served from GCS), never next/image, so take
  // the /_next/image optimizer endpoint (and its advisory history) off the surface.
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;

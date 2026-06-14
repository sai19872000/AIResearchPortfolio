import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone server bundle for a small Cloud Run container.
  output: "standalone",
  // Firestore Admin SDK is a Node library with native/dynamic deps — keep it
  // external rather than bundling it into the server build.
  serverExternalPackages: ["@google-cloud/firestore"],
};

export default nextConfig;

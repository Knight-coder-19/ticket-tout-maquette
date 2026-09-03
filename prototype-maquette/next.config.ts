import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hides the on-screen dev-mode route indicator (the "N" badge bottom-left).
  // Dev-only chrome — never shows in a production build regardless.
  devIndicators: false,
};

export default nextConfig;

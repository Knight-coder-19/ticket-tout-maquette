/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Masque le badge de route en dev (il chevauchait le pied du rail).
  devIndicators: false,
};

export default nextConfig;

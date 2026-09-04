/** @type {import('next').NextConfig} */

// Branche `maquette-statique` : export figé pour GitHub Pages, aucun backend.
// Les mocks sont rejoués dans le navigateur (src/mocks/serveur-local.ts).
// NEXT_PUBLIC_BASE_PATH = sous-chemin de publication (Project Page).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/ticket-tout-maquette";

const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;

/** @type {import('next').NextConfig} */

// Maquette statique (GitHub Pages). Le site est un export figé : les données
// viennent des mocks, aucun backend. `NEXT_PUBLIC_BASE_PATH` = sous-chemin
// de publication (ex. "/G-SVR-500-COT-5-1-survivor-21" pour une Project Page).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;

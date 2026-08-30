/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["mysql2", "ioredis"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

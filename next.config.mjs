/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.loca.lt",
    "*.ngrok.io",
    "*.ngrok-free.app",
    "*.pinggy.link",
    "localhost:3000",
    "192.168.10.115:3000",
    "192.168.10.115",
  ],
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
      allowedOrigins: [
        "menuversebd.com",
        "*.menuversebd.com",
        "menuverse.app",
        "*.menuverse.app",
        "*.hstgr.cloud",
        "srv1295490.hstgr.cloud",
        "srv1295490.hstgr.cloud:3000",
        "*.trycloudflare.com",
        "*.loca.lt",
        "*.ngrok.io",
        "*.ngrok-free.app",
        "*.pinggy.link",
        "localhost:3000",
        "127.0.0.1:3000",
        "192.168.10.115:3000",
      ],
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, bypass-tunnel-reminder",
          },
        ],
      },
    ];
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

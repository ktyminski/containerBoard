import type { NextConfig } from "next";

const envAllowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.*.*",
    "10.*.*.*",
    ...envAllowedDevOrigins,
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "flagcdn.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
    localPatterns: [
      {
        pathname: "/api/companies/**",
      },
      {
        pathname: "/api/containers/**",
      },
      {
        pathname: "/photos/**",
      },
    ],
  },
};

export default nextConfig;

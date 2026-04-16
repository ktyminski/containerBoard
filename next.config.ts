import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "flagcdn.com",
        pathname: "/**",
      },
    ],
    localPatterns: [
      {
        pathname: "/api/companies/**",
      },
      {
        pathname: "/photos/**",
      },
    ],
  },
};

export default nextConfig;

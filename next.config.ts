import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
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

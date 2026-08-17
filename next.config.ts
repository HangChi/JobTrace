import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    cpus: 1,
  },
  output: "standalone",
  poweredByHeader: false,
  typedRoutes: true,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;

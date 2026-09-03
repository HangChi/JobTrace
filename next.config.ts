import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    cpus: 1,
    proxyClientMaxBodySize: "6mb",
  },
  output: "standalone",
  poweredByHeader: false,
  typedRoutes: true,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async headers() {
    const headers = [
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=()",
      },
    ];
    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;

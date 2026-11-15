import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The review prompt and demo data are read from disk at runtime / build time.
  outputFileTracingIncludes: {
    "/api/review": ["./src/core/prompts/**/*"],
    "/api/testscript": ["./src/core/prompts/**/*"],
    "/demo-data": ["./data/demo-rcm.xlsx", "./data/demo-results.json", "./data/demo-testscripts.json", "./data/ai-pack-rcm.xlsx", "./data/ai-pack-results.json", "./data/ai-pack-testscripts.json", "./data/ai-pack.mappings.json"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

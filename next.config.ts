import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "sqlite-vec"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      { source: "/journal", destination: "/events", permanent: false },
      {
        source: "/journal/:path*",
        destination: "/events/:path*",
        permanent: false,
      },
      { source: "/recall", destination: "/search", permanent: false },
      { source: "/chat", destination: "/assistant", permanent: false },
      {
        source: "/chat/:path*",
        destination: "/assistant/:path*",
        permanent: false,
      },
      { source: "/memories", destination: "/settings", permanent: false },
    ];
  },
};

export default nextConfig;

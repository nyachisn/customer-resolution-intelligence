import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // The browser must never reach Snowflake. The app consumes a curated,
  // versioned export or a server-only route. See docs/05_architecture.md §7.
  env: {
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
    DEMO_DATA_VERSION: process.env.DEMO_DATA_VERSION ?? "unset",
  },
};

export default nextConfig;

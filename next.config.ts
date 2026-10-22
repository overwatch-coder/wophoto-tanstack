import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    agentUpgrade: "security",
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
}

export default nextConfig

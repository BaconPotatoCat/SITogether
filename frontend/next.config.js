const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Disable ESLint during production builds since we have a separate lint script
    ignoreDuringBuilds: true,
  },
  // Note: API route body size limits are configured per-route using export const config
  // See frontend/pages/api/users/[id].ts for example
  // Set outputFileTracingRoot to frontend directory to silence monorepo lockfile warning
  outputFileTracingRoot: path.resolve(__dirname),
}

module.exports = nextConfig

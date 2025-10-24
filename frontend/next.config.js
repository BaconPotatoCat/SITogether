/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Disable ESLint during production builds since we have a separate lint script
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig

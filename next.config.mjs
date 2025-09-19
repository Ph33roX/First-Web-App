/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ["yahoo-finance2"]
  },
  output: "standalone"
};

export default nextConfig;

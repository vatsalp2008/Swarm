/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages are TS source; let Next.js transpile them.
  transpilePackages: [
    '@swarm/db',
    '@swarm/shared',
    '@swarm/audit',
    '@swarm/token-vault',
    '@swarm/bee-sdk',
  ],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
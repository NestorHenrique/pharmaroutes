/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Ignora erros de TypeScript no build
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignora avisos do ESLint no build
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
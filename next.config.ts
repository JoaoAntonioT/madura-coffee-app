import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignora os erros de TypeScript e ESLint apenas no momento de subir para a Vercel
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
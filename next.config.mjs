/** @type {import('next').NextConfig} */
const nextConfig = {
  // Gera um build minimalista e autossuficiente (.next/standalone) com um
  // server.js próprio. Essencial para uma imagem Docker pequena e production-grade.
  output: 'standalone',
};

export default nextConfig;

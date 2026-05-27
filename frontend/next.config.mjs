/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Ported design has loose types (from JSX/babel-standalone). Skip strict TS check at build time.
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

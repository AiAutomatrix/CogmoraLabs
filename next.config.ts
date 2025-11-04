
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    allowedDevOrigins: [
      "https://6000-firebase-studio-1747864089303.cluster-3ch54x2epbcnetrm6ivbqqebjk.cloudworkstations.dev",
      "http://6000-firebase-studio-1747864089303.cluster-3ch54x2epbcnetrm6ivbqqebjk.cloudworkstations.dev",
      "https://9000-firebase-studio-1747864089303.cluster-3ch54x2epbcnetrm6ivbqqebjk.cloudworkstations.dev",
      "http://9000-firebase-studio-1747864089303.cluster-3ch54x2epbcnetrm6ivbqqebjk.cloudworkstations.dev",
      "https://9000-firebase-studio-1759013558667.cluster-c72u3gwiofapkvxrcwjq5zllcu.cloudworkstations.dev",
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'dd.dexscreener.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.dexscreener.com', // Added this new hostname
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;

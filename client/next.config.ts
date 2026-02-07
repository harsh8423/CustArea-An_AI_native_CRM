import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
      {
        source: '/oauth/:path*',
        destination: 'http://localhost:8000/oauth/:path*',
      },
      {
        source: '/webhook/:path*',
        destination: 'http://localhost:8000/webhook/:path*',
      },
      {
        source: '/phone-ws/:path*',
        destination: 'http://localhost:8000/phone-ws/:path*',
      },
    ];
  },
};

export default nextConfig;


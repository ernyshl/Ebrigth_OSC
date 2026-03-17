import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  compress: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  generateEtags: true,
  pageExtensions: ["ts", "tsx", "js", "jsx"],
  /* Configure rewrites for localhost preview */
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/:path*",
          destination: "/:path*",
        },
      ],
    };
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // 👈 aumenta el límite, puedes poner "20mb" o más
    },
  },
};

export default nextConfig;

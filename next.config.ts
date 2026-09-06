import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  // A rota inicial e as navegações podem variar conforme a sessão.
  cacheStartUrl: false,
  dynamicStartUrl: false,
  cacheOnFrontEndNav: false,
  extendDefaultRuntimeCaching: false,
  workboxOptions: {
    // Os arquivos públicos do build e a página offline continuam no precache.
    // Nenhuma resposta obtida durante o uso do app deve persistir no cache.
    runtimeCaching: [
      {
        urlPattern: /.*/i,
        handler: "NetworkOnly",
        options: {
          fetchOptions: { cache: "no-store" },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);

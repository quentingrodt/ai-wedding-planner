import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // Photos du swipe d'inspiration (licence Unsplash), toujours
    // demandées avec le même recadrage (voir src/lib/inspiration/photos.ts).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/photo-**",
        search: "?auto=format&fit=crop&w=1200&h=1600&q=80",
      },
    ],
  },
};

export default withNextIntl(nextConfig);

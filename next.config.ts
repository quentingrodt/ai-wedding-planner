import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Spotify refuse « localhost » comme adresse de retour OAuth : en local, l'app
  // s'ouvre sur http://127.0.0.1:3000, que le serveur de dev bloque par défaut.
  allowedDevOrigins: ["127.0.0.1"],
  // Polices TTF lues par readFile dans la route d'export des faire-part.
  outputFileTracingIncludes: {
    "/api/invitations/image": ["./assets/fonts/**"],
    "/api/invitations/pdf": ["./assets/fonts/**"],
    "/api/seating/pdf": ["./assets/fonts/**"],
  },
  images: {
    // Photos du swipe d'inspiration (licences Unsplash et Pexels), toujours
    // demandées avec le même recadrage (voir src/lib/inspiration/photos.ts).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/photo-**",
        search: "?auto=format&fit=crop&w=1200&h=1600&q=80",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
        pathname: "/photos/**",
        search: "?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=1600",
      },
      // Pochettes d'album renvoyées par la recherche Spotify.
      { protocol: "https", hostname: "i.scdn.co", pathname: "/image/**" },
    ],
  },
};

export default withNextIntl(nextConfig);

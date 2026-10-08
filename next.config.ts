import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * En-têtes de sécurité, sur toutes les réponses. Pas encore de politique
 * stricte des scripts (le lecteur Spotify et le widget Pinterest chargent
 * leurs propres scripts) : la CSP se limite à ce qui ne casse rien.
 */
const SECURITY_HEADERS = [
  // Céleste ne s'affiche jamais dans le cadre d'un autre site (clickjacking).
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Les liens personnels des invités (/i/<jeton>) ne fuitent pas vers les sites externes.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Spotify refuse « localhost » comme adresse de retour OAuth : en local, l'app
  // s'ouvre sur http://127.0.0.1:3000, que le serveur de dev bloque par défaut.
  allowedDevOrigins: ["127.0.0.1"],
  // Polices TTF lues par readFile dans la route d'export des faire-part.
  outputFileTracingIncludes: {
    "/api/invitations/image": ["./assets/fonts/**"],
    "/api/invitations/pdf": ["./assets/fonts/**"],
    "/api/seating/pdf": ["./assets/fonts/**"],
    "/api/lodging/pdf": ["./assets/fonts/**"],
    "/api/playlist/pdf": ["./assets/fonts/**"],
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

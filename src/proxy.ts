import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 : l'ancien middleware.ts s'appelle désormais proxy.ts.
// La session Supabase y sera chaînée à l'étape 4.
export default createMiddleware(routing);

export const config = {
  // Tout sauf les routes API, les fichiers internes Next/Vercel et les fichiers statiques (avec extension).
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};

import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { updateSession } from "./utils/supabase/middleware";

const handleI18nRouting = createMiddleware(routing);

// Next.js 16 : l'ancien middleware.ts s'appelle désormais proxy.ts.
export default async function proxy(request: NextRequest) {
  // 1. next-intl décide du routage (rewrite "/" → "/fr", redirection "/fr" → "/", détection de langue).
  const response = handleI18nRouting(request);

  // 2. Supabase rafraîchit la session et ajoute ses cookies sur CETTE réponse.
  return updateSession(request, response);
}

export const config = {
  // Tout sauf les routes API, les fichiers internes Next/Vercel et les fichiers statiques (avec extension).
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};

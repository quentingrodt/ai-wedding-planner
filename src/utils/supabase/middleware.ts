import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Rafraîchit la session Supabase et écrit les cookies mis à jour sur la
 * réponse fournie (celle de next-intl), sans la remplacer : ses redirections,
 * rewrites et en-têtes de locale sont conservés.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
) {
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Côté requête : les Server Components de cette même requête
        // liront le jeton rafraîchi.
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        // Côté réponse : le navigateur reçoit les nouveaux cookies.
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // En-têtes anti-cache : une réponse portant un jeton ne doit jamais être mise en cache par un CDN.
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Ne rien intercaler entre la création du client et cet appel : c'est lui
  // qui valide le JWT et déclenche le rafraîchissement si nécessaire.
  await supabase.auth.getClaims();

  return response;
}

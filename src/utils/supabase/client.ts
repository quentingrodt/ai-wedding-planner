import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Client Supabase pour Server Components, Server Actions et Route Handlers.
 * Next 16 : cookies() est asynchrone. Créer un nouveau client par requête.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Appelé depuis un Server Component (cookies en lecture seule) :
          // sans conséquence, le proxy rafraîchit la session à chaque requête.
        }
      },
    },
  });
}

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * Client Supabase « service_role » : contourne la RLS. Réservé au serveur,
 * pour les tables sans aucun accès client (secrets comme les jetons Spotify).
 * Ne jamais l'importer dans un composant client ni l'exposer via une action
 * qui renverrait ses lectures telles quelles.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY doit être définie (.env.local, serveur uniquement).");
  }
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

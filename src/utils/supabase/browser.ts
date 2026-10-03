import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

/** Client Supabase pour les Client Components ("use client"). */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

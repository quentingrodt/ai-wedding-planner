"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/utils/supabase/client";

/** Ferme la session (cookies effacés) puis renvoie vers la connexion. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) console.error("[auth] signOut:", error.status, error.code);

  redirect({ href: "/login", locale: await getLocale() });
}

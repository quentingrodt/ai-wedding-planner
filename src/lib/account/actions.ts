"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUserId } from "@/lib/weddings/queries";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/client";
import { deleteAccountData } from "./server";

export type DeleteAccountResult = { ok: false; error: "unauthenticated" | "generic" };

/**
 * Efface le compte de la personne connectée et ce qui n'appartient qu'à
 * elle (voir deletion-plan.ts), puis la renvoie à l'accueil, déconnectée.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };

  try {
    await deleteAccountData(createAdminClient(), userId);
  } catch (error) {
    console.error("[account] delete:", error instanceof Error ? error.message : error);
    return { ok: false, error: "generic" };
  }

  // Le compte n'existe plus : on efface aussi la session de ce navigateur.
  await supabase.auth.signOut({ scope: "local" });
  return redirect({ href: "/", locale: await getLocale() });
}

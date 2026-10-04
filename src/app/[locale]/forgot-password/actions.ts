"use server";

import type { Locale } from "next-intl";
import { getLocale } from "next-intl/server";
import { authCallbackUrl } from "@/lib/auth/redirect";
import { emailSchema, type AuthState } from "@/lib/auth/schema";
import { createClient } from "@/utils/supabase/client";

/**
 * Envoie un lien pour choisir un nouveau mot de passe. Sert aussi aux comptes
 * créés par Magic Link, qui n'ont pas encore de mot de passe.
 */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { status: "error", code: "invalidEmail" };
  const email = parsed.data;

  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: await authCallbackUrl(locale, {}, { next: "reset-password" }),
  });

  if (error) {
    console.error("[auth] resetPasswordForEmail:", error.status, error.code);
    // Hors limitation de débit, on répond toujours « envoyé » : la page ne doit
    // pas révéler si un compte existe pour cette adresse.
    if (error.status === 429) return { status: "error", code: "rateLimited" };
  }

  return { status: "sent", email };
}

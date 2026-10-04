"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { passwordSchema, toAuthErrorCode, type AuthState } from "@/lib/auth/schema";
import { createClient } from "@/utils/supabase/client";

/** Enregistre le nouveau mot de passe de l'utilisateur connecté par le lien reçu. */
export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return { status: "error", code: "weakPassword" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });

  if (error) {
    console.error("[auth] updateUser:", error.status, error.code);
    return { status: "error", code: toAuthErrorCode(error) };
  }

  return redirect({ href: "/dashboard", locale: await getLocale() });
}

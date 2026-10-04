"use server";

import { redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getLocale } from "next-intl/server";
import { afterAuthPath } from "@/lib/auth/redirect";
import { signInSchema, toAuthErrorCode, type AuthState } from "@/lib/auth/schema";
import { parseHandoff } from "@/lib/onboarding/schema";
import { parseInviteToken } from "@/lib/team/schema";
import { createClient } from "@/utils/supabase/client";

/** Connexion par email et mot de passe. */
export async function signInWithPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { status: "error", code: field === "email" ? "invalidEmail" : "missingPassword" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Message brut journalisé côté serveur uniquement, jamais affiché.
    console.error("[auth] signInWithPassword:", error.status, error.code);
    return { status: "error", code: toAuthErrorCode(error) };
  }

  const locale = (await getLocale()) as Locale;
  redirect(
    afterAuthPath(locale, parseHandoff(formData), parseInviteToken(formData.get("invite"))),
  );
}

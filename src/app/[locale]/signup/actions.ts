"use server";

import { redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getLocale } from "next-intl/server";
import { afterAuthPath, authCallbackUrl } from "@/lib/auth/redirect";
import { signUpSchema, toAuthErrorCode, type AuthState } from "@/lib/auth/schema";
import { parseHandoff } from "@/lib/onboarding/schema";
import { parseInviteToken } from "@/lib/team/schema";
import { createClient } from "@/utils/supabase/client";

/** Création de compte par email et mot de passe. */
export async function signUpWithPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { status: "error", code: field === "email" ? "invalidEmail" : "weakPassword" };
  }
  const { email, password } = parsed.data;

  const locale = (await getLocale()) as Locale;
  const handoff = parseHandoff(formData);
  const invite = parseInviteToken(formData.get("invite"));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Utilisé uniquement si la confirmation d'email est activée côté Supabase.
    options: { emailRedirectTo: await authCallbackUrl(locale, handoff, invite ? { invite } : {}) },
  });

  if (error) {
    console.error("[auth] signUp:", error.status, error.code);
    return { status: "error", code: toAuthErrorCode(error) };
  }

  // Sans session, Supabase attend la confirmation de l'adresse email.
  if (!data.session) return { status: "sent", email };

  redirect(afterAuthPath(locale, handoff, invite));
}

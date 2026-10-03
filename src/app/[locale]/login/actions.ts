"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { createClient } from "@/utils/supabase/client";
import { loginSchema, type LoginState } from "./schema";

/** Envoie un Magic Link (OTP par email). Crée le compte s'il n'existe pas. */
export async function signInWithMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", code: "invalidEmail" };
  }
  const { email } = parsed.data;

  const headerList = await headers();
  const origin =
    headerList.get("origin") ?? `https://${headerList.get("host")}`;
  const locale = await getLocale();
  const callbackPath = getPathname({ href: "/auth/callback", locale });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}${callbackPath}`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    // Message brut journalisé côté serveur uniquement, jamais affiché.
    console.error("[auth] signInWithOtp:", error.status, error.code);
    return {
      status: "error",
      code: error.status === 429 ? "rateLimited" : "generic",
    };
  }

  return { status: "sent", email };
}

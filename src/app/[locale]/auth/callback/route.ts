import { NextResponse, type NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { afterAuthPath } from "@/lib/auth/redirect";
import { parseHandoff, withHandoff } from "@/lib/onboarding/schema";
import { parseInviteToken } from "@/lib/team/schema";
import { createClient } from "@/utils/supabase/client";

/**
 * Retour des liens envoyés par email (flux PKCE) : confirmation d'inscription
 * ou réinitialisation du mot de passe. Échange le `code` contre une session,
 * puis redirige vers l'étape suivante dans la langue de l'utilisateur, en
 * conservant le projet Date Night éventuel (budget, invités, style).
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/[locale]/auth/callback">,
) {
  const { locale: rawLocale } = await params;
  const locale = hasLocale(routing.locales, rawLocale)
    ? rawLocale
    : routing.defaultLocale;
  const { origin, searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const handoff = parseHandoff(searchParams);
  const invite = parseInviteToken(searchParams.get("invite"));
  const isPasswordReset = searchParams.get("next") === "reset-password";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const next = isPasswordReset
        ? getPathname({ href: "/reset-password", locale })
        : afterAuthPath(locale, handoff, invite);
      return NextResponse.redirect(new URL(next, origin));
    }
    console.error("[auth] exchangeCodeForSession:", error.status, error.code);
  }

  const fallbackPath = getPathname({
    href: isPasswordReset ? "/forgot-password" : "/login",
    locale,
  });
  return NextResponse.redirect(
    new URL(
      withHandoff(fallbackPath, handoff, {
        error: "link_expired",
        ...(invite ? { invite } : {}),
      }),
      origin,
    ),
  );
}

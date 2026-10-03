import { NextResponse, type NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { parseHandoff, withHandoff } from "@/lib/onboarding/schema";
import { createClient } from "@/utils/supabase/client";

/**
 * Retour du Magic Link (flux PKCE) : échange le `code` contre une session,
 * puis redirige vers l'onboarding dans la langue de l'utilisateur, en
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

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // L'onboarding renvoie lui-même au dashboard si un mariage existe déjà.
      const onboardingPath = getPathname({ href: "/onboarding", locale });
      return NextResponse.redirect(
        new URL(withHandoff(onboardingPath, handoff), origin),
      );
    }
    console.error("[auth] exchangeCodeForSession:", error.status, error.code);
  }

  const loginPath = getPathname({ href: "/login", locale });
  return NextResponse.redirect(
    new URL(withHandoff(loginPath, handoff, { error: "link_expired" }), origin),
  );
}

import { NextResponse, type NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { parseHandoff, withHandoff } from "@/lib/onboarding/schema";
import { parseInviteToken } from "@/lib/team/schema";
import { createClient } from "@/utils/supabase/client";

/**
 * Retour du Magic Link (flux PKCE) : échange le `code` contre une session,
 * puis redirige vers l'onboarding dans la langue de l'utilisateur, en
 * conservant le projet Date Night éventuel (budget, invités, style).
 * Un invité est renvoyé vers sa page d'invitation plutôt que l'onboarding.
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

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (invite) {
        const invitePath = getPathname({ href: `/invite/${invite}`, locale });
        return NextResponse.redirect(new URL(invitePath, origin));
      }
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
    new URL(
      withHandoff(loginPath, handoff, {
        error: "link_expired",
        ...(invite ? { invite } : {}),
      }),
      origin,
    ),
  );
}

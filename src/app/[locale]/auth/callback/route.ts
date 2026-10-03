import { NextResponse, type NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/utils/supabase/client";

/**
 * Retour du Magic Link (flux PKCE) : échange le `code` contre une session,
 * puis redirige vers l'accueil dans la langue de l'utilisateur.
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

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(
        new URL(getPathname({ href: "/", locale }), origin),
      );
    }
    console.error("[auth] exchangeCodeForSession:", error.status, error.code);
  }

  const loginPath = getPathname({ href: "/login", locale });
  return NextResponse.redirect(
    new URL(`${loginPath}?error=link_expired`, origin),
  );
}

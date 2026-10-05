import { hasLocale, type Locale } from "next-intl";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { routing } from "@/i18n/routing";

/*
 * Protection CSRF du flux OAuth : le paramètre state est un jeton aléatoire,
 * copié dans un cookie httpOnly avec le mariage visé. Au retour, Spotify doit
 * renvoyer exactement ce jeton, sinon la liaison est refusée.
 */

export const OAUTH_COOKIE = "celeste_spotify_oauth";
/** Le cookie n'est envoyé qu'aux routes /api/spotify, pendant 10 minutes. */
export const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/spotify",
  maxAge: 600,
} as const;

const oauthCookieSchema = z.object({
  state: z.string().min(32),
  weddingId: z.uuid(),
  locale: z.string(),
});
export type OAuthCookie = { state: string; weddingId: string; locale: Locale };

export function readOAuthCookie(value: string | undefined): OAuthCookie | null {
  if (!value) return null;
  try {
    const parsed = oauthCookieSchema.safeParse(JSON.parse(value));
    if (!parsed.success) return null;
    const { locale } = parsed.data;
    return {
      ...parsed.data,
      locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
    };
  } catch {
    return null;
  }
}

/** Issue affichée par la page playlist après le retour de Spotify. */
export type ConnectStatus = "connected" | "denied" | "error" | "forbidden";

/** Chemin de la page playlist dans la langue du couple (fr sans préfixe). */
export function playlistPath(locale: Locale, status?: ConnectStatus): string {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return `${prefix}/playlist${status ? `?spotify=${status}` : ""}`;
}

/**
 * Origine réellement utilisée par le navigateur. En développement, Next
 * normalise nextUrl en « localhost » même sur http://127.0.0.1:3000, ce que
 * Spotify refuse comme adresse de retour : on lit donc l'en-tête Host (et
 * x-forwarded-* derrière le proxy de Vercel). Un Host falsifié ne mène nulle
 * part : Spotify n'accepte que les adresses de retour déclarées.
 */
export function requestOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return request.nextUrl.origin;
  const protocol =
    request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${protocol}://${host}`;
}

import { randomBytes } from "node:crypto";
import { hasLocale } from "next-intl";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { getCoupleWedding } from "@/lib/spotify/access";
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_OPTIONS,
  playlistPath,
  requestOrigin,
} from "@/lib/spotify/oauth";
import { SPOTIFY_SCOPES } from "@/lib/spotify/schema";
import { spotifyClientId, spotifyRedirectUri } from "@/lib/spotify/server";

/**
 * Départ du flux OAuth : redirige vers l'écran d'autorisation Spotify.
 * Le mariage visé reste côté serveur (cookie httpOnly) ; Spotify ne reçoit
 * qu'un jeton aléatoire dans state.
 */
export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("locale");
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const origin = requestOrigin(request);

  const access = await getCoupleWedding();
  if (!access.ok) {
    const target =
      access.error === "unauthenticated"
        ? `${locale === routing.defaultLocale ? "" : `/${locale}`}/login`
        : playlistPath(locale, "forbidden");
    return NextResponse.redirect(new URL(target, origin));
  }

  const state = randomBytes(32).toString("base64url");
  const authorize = new URL("https://accounts.spotify.com/authorize");
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: spotifyClientId(),
    scope: SPOTIFY_SCOPES.join(" "),
    redirect_uri: spotifyRedirectUri(origin),
    state,
  }).toString();

  const response = NextResponse.redirect(authorize);
  response.cookies.set(
    OAUTH_COOKIE,
    JSON.stringify({ state, weddingId: access.wedding.id, locale }),
    OAUTH_COOKIE_OPTIONS,
  );
  return response;
}

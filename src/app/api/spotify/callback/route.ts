import { getTranslations } from "next-intl/server";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { getCoupleWedding } from "@/lib/spotify/access";
import {
  OAUTH_COOKIE,
  playlistPath,
  readOAuthCookie,
  requestOrigin,
  type ConnectStatus,
} from "@/lib/spotify/oauth";
import { connectSpotify, exchangeCode, spotifyRedirectUri } from "@/lib/spotify/server";

/**
 * Retour d'autorisation Spotify : vérifie state, échange le code contre les
 * jetons, crée la playlist « Mariage de … » et enregistre la liaison.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = requestOrigin(request);
  const pending = readOAuthCookie(request.cookies.get(OAUTH_COOKIE)?.value);
  const locale = pending?.locale ?? routing.defaultLocale;

  const finish = (status: ConnectStatus) => {
    const response = NextResponse.redirect(new URL(playlistPath(locale, status), origin));
    response.cookies.delete({ name: OAUTH_COOKIE, path: "/api/spotify" });
    return response;
  };

  // Le couple a refusé sur l'écran Spotify.
  if (params.get("error")) return finish("denied");

  const code = params.get("code");
  const state = params.get("state");
  if (!pending || !code || !state || state !== pending.state) return finish("error");

  // Le mariage du cookie doit toujours être celui des mariés connectés.
  const access = await getCoupleWedding();
  if (!access.ok || access.wedding.id !== pending.weddingId) return finish("forbidden");

  try {
    const t = await getTranslations({ locale, namespace: "Playlist" });
    const token = await exchangeCode(code, spotifyRedirectUri(origin));
    await connectSpotify({
      weddingId: access.wedding.id,
      token,
      playlistName: t("spotifyPlaylist.name", { names: access.wedding.title }),
      playlistDescription: t("spotifyPlaylist.description"),
    });
  } catch (error) {
    console.error("[spotify] callback:", error instanceof Error ? error.message : "unknown");
    return finish("error");
  }

  return finish("connected");
}

"use server";

import { revalidatePath } from "next/cache";
import { getCoupleWedding } from "./access";
import {
  searchQuerySchema,
  searchResponseSchema,
  SPOTIFY_SEARCH_LIMIT,
  toSpotifyTrack,
  trackUriSchema,
  type SpotifyActionError,
  type SpotifyActionResult,
  type SpotifySearchResult,
} from "./schema";
import {
  disconnectSpotifyIntegration,
  getSpotifyIntegration,
  getValidAccessToken,
  spotifyApi,
  SpotifyError,
} from "./server";

const toError = (error: unknown): SpotifyActionError => {
  if (error instanceof SpotifyError) return error.code;
  console.error("[spotify] action:", error instanceof Error ? error.message : "unknown");
  return "generic";
};

/** Recherche de morceaux, avec le compte Spotify lié au mariage courant. */
export async function searchSpotify(query: string): Promise<SpotifySearchResult> {
  const parsed = searchQuerySchema.safeParse(query);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const access = await getCoupleWedding();
  if (!access.ok) return access;

  try {
    const token = await getValidAccessToken(access.wedding.id);
    const params = new URLSearchParams({
      q: parsed.data,
      type: "track",
      limit: String(SPOTIFY_SEARCH_LIMIT),
      market: "from_token",
    });
    const response = searchResponseSchema.safeParse(
      await spotifyApi(token, `/search?${params.toString()}`),
    );
    if (!response.success) return { ok: false, error: "generic" };

    return { ok: true, tracks: response.data.tracks.items.map(toSpotifyTrack) };
  } catch (error) {
    return { ok: false, error: toError(error) };
  }
}

/**
 * Ajoute un morceau à la playlist du mariage. weddingId vient du navigateur :
 * il doit désigner le mariage dont l'utilisateur connecté est l'un des mariés.
 */
export async function addToPlaylist(
  weddingId: string,
  trackUri: string,
): Promise<SpotifyActionResult> {
  const uri = trackUriSchema.safeParse(trackUri);
  if (!uri.success) return { ok: false, error: "invalid" };

  const access = await getCoupleWedding();
  if (!access.ok) return access;
  if (access.wedding.id !== weddingId) return { ok: false, error: "forbidden" };

  try {
    const integration = await getSpotifyIntegration(weddingId);
    if (!integration) return { ok: false, error: "disconnected" };
    if (!integration.playlistId) return { ok: false, error: "playlistMissing" };

    const token = await getValidAccessToken(weddingId);
    await spotifyApi(token, `/playlists/${encodeURIComponent(integration.playlistId)}/items`, {
      method: "POST",
      body: { uris: [uri.data] },
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toError(error) };
  }
}

/** Délie le compte Spotify : la playlist reste dans la bibliothèque du couple. */
export async function disconnectSpotify(): Promise<SpotifyActionResult> {
  const access = await getCoupleWedding();
  if (!access.ok) return access;
  try {
    await disconnectSpotifyIntegration(access.wedding.id);
  } catch (error) {
    return { ok: false, error: toError(error) };
  }
  revalidatePath("/[locale]/playlist", "page");
  return { ok: true };
}

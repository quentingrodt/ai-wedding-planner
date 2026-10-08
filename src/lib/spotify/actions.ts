"use server";

import { revalidatePath } from "next/cache";
import { PLAYLIST_SECTIONS } from "@/lib/playlist/schema";
import { getWeddingPlaylist } from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { getCoupleWedding } from "./access";
import type { SpotifyActionError, SpotifyActionResult } from "./schema";
import {
  disconnectSpotifyIntegration,
  getPlaylistTracks,
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

/** Spotify accepte 100 morceaux au plus par ajout. */
const ADD_BATCH = 100;

export type SendToSpotifyResult = { ok: true; added: number } | { ok: false; error: SpotifyActionError };

/**
 * Envoie la playlist de Céleste dans la playlist Spotify du couple : les
 * morceaux validés qui n'y sont pas encore y sont ajoutés, dans l'ordre de la
 * journée. « À ne pas passer » reste dans Céleste ; rien n'est retiré de Spotify.
 */
export async function sendToSpotify(): Promise<SendToSpotifyResult> {
  const access = await getCoupleWedding();
  if (!access.ok) return access;
  const weddingId = access.wedding.id;

  try {
    const integration = await getSpotifyIntegration(weddingId);
    if (!integration) return { ok: false, error: "disconnected" };
    if (!integration.playlistId) return { ok: false, error: "playlistMissing" };

    const [tracks, current] = await Promise.all([
      getWeddingPlaylist(await createClient(), weddingId),
      getPlaylistTracks(weddingId, integration.playlistId),
    ]);
    const present = new Set(current.tracks.map((track) => track.uri));
    const order = (section: (typeof PLAYLIST_SECTIONS)[number]) => PLAYLIST_SECTIONS.indexOf(section);
    const uris = tracks
      .filter((track) => track.status === "approved" && track.section !== "do_not_play")
      .sort((a, b) => order(a.section) - order(b.section))
      .map((track) => `spotify:track:${track.spotify_id}`)
      .filter((uri) => !present.has(uri));

    const token = await getValidAccessToken(weddingId);
    for (let start = 0; start < uris.length; start += ADD_BATCH) {
      await spotifyApi(token, `/playlists/${encodeURIComponent(integration.playlistId)}/items`, {
        method: "POST",
        body: { uris: uris.slice(start, start + ADD_BATCH) },
      });
    }
    return { ok: true, added: uris.length };
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
  revalidatePath("/[locale]/(app)/playlist", "page");
  return { ok: true };
}

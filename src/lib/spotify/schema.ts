import { z } from "zod";

/** Droits demandés au couple : créer et remplir la playlist, lire son identifiant. */
export const SPOTIFY_SCOPES = [
  "playlist-modify-public",
  "playlist-modify-private",
  "user-read-private",
] as const;

/** Spotify plafonne la recherche à 10 résultats par appel (février 2026). */
export const SPOTIFY_SEARCH_LIMIT = 10;
export const SPOTIFY_QUERY_MAX = 100;

/** Morceau tel qu'affiché dans la recherche et dans la playlist. */
export type SpotifyTrack = {
  id: string;
  name: string;
  artist: string;
  cover_url: string | null;
  uri: string;
  duration_ms: number | null;
};

export const searchQuerySchema = z.string().trim().min(1).max(SPOTIFY_QUERY_MAX);
export const trackUriSchema = z.string().regex(/^spotify:track:[A-Za-z0-9]{22}$/);

/** Réponse de POST /api/token (code d'autorisation ou rafraîchissement). */
export const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  // Toujours présent à l'échange du code ; parfois renvoyé (rotation) au rafraîchissement.
  refresh_token: z.string().min(1).optional(),
});
export type TokenResponse = z.infer<typeof tokenResponseSchema>;

const imageSchema = z.object({ url: z.url(), width: z.number().nullable().optional() });

const trackSchema = z.object({
  id: z.string(),
  name: z.string(),
  uri: z.string(),
  duration_ms: z.number().optional(),
  artists: z.array(z.object({ name: z.string() })),
  album: z.object({ images: z.array(imageSchema) }).optional(),
});
type ApiTrack = z.infer<typeof trackSchema>;

/** Sous-ensemble utile de GET /v1/search?type=track. */
export const searchResponseSchema = z.object({
  tracks: z.object({ items: z.array(trackSchema) }),
});

/** Plafond de pages lues pour la playlist (50 morceaux par page). */
export const PLAYLIST_PAGE_SIZE = 50;
export const PLAYLIST_MAX_PAGES = 10;

/**
 * Sous-ensemble utile de GET /v1/playlists/{id}/items (février 2026 : le
 * morceau est dans « item », plus dans « track »). Les épisodes de podcast et
 * fichiers locaux sont ignorés.
 */
export const playlistItemsResponseSchema = z.object({
  total: z.number(),
  next: z.string().nullable(),
  items: z.array(
    z.object({
      is_local: z.boolean().optional(),
      item: z.object({ type: z.string() }).loose().nullable(),
    }),
  ),
});

export const parseApiTrack = (value: unknown): ApiTrack | null => {
  const parsed = trackSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

/** Morceau de l'API vers l'affichage ; pochette nette en 56 px (Spotify : 640, 300, 64). */
export function toSpotifyTrack(track: ApiTrack): SpotifyTrack {
  const images = [...(track.album?.images ?? [])].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const cover = images.find((image) => (image.width ?? 0) >= 128) ?? images.at(-1);
  return {
    id: track.id,
    name: track.name,
    artist: track.artists.map((artist) => artist.name).join(", "),
    cover_url: cover?.url ?? null,
    uri: track.uri,
    duration_ms: track.duration_ms ?? null,
  };
}

export type SpotifyActionError =
  | "unauthenticated"
  | "forbidden"
  | "invalid"
  /** Aucun compte lié, ou accès retiré depuis Spotify : il faut reconnecter. */
  | "disconnected"
  /** La playlist a été supprimée côté Spotify. */
  | "playlistMissing"
  | "rateLimited"
  | "generic";

export type SpotifyActionResult = { ok: true } | { ok: false; error: SpotifyActionError };

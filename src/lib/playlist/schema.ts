import { z } from "zod";

/*
 * Playlist du mariage tenue dans Céleste (000037) : morceaux trouvés dans le
 * catalogue Spotify, rangés par moment de la journée.
 */

/** Moments, dans l'ordre de la journée ; « à ne pas passer » ferme la liste. */
export const PLAYLIST_SECTIONS = [
  "ceremony_entrance",
  "ceremony",
  "ceremony_exit",
  "cocktail",
  "dinner",
  "first_dance",
  "party",
  "last_dance",
  "do_not_play",
] as const;
export type PlaylistSection = (typeof PLAYLIST_SECTIONS)[number];

/** Moment proposé par défaut à l'ajout : c'est là que se trouvent la plupart des morceaux. */
export const DEFAULT_SECTION: PlaylistSection = "party";

export const PLAYLIST_STATUSES = ["suggested", "approved"] as const;
export type PlaylistStatus = (typeof PLAYLIST_STATUSES)[number];

/** Ligne de playlist_tracks, telle que lue par la page. */
export type PlaylistTrack = {
  id: string;
  spotify_id: string;
  name: string;
  artist: string;
  cover_url: string | null;
  duration_ms: number | null;
  section: PlaylistSection;
  status: PlaylistStatus;
  created_by: string;
  created_at: string;
};

export const PLAYLIST_TRACK_COLUMNS =
  "id, spotify_id, name, artist, cover_url, duration_ms, section, status, created_by, created_at";

/** Limites alignées sur les contraintes CHECK de 000037. */
export const PLAYLIST_LIMITS = { name: 300, artist: 500 } as const;

export const spotifyIdSchema = z.string().regex(/^[A-Za-z0-9]{22}$/);
export const sectionSchema = z.enum(PLAYLIST_SECTIONS);

/** Morceau choisi dans la recherche, tel qu'envoyé par le navigateur. */
export const newTrackSchema = z.object({
  spotify_id: spotifyIdSchema,
  name: z.string().trim().min(1).max(PLAYLIST_LIMITS.name),
  artist: z.string().trim().min(1).max(PLAYLIST_LIMITS.artist),
  cover_url: z
    .string()
    .regex(/^https:\/\/i\.scdn\.co\/image\/[A-Za-z0-9]+$/)
    .nullable(),
  duration_ms: z.number().int().positive().nullable(),
  section: sectionSchema,
});
export type NewTrack = z.input<typeof newTrackSchema>;

export type PlaylistError =
  | "unauthenticated"
  | "forbidden"
  | "invalid"
  | "duplicate"
  | "rateLimited"
  | "generic";
export type PlaylistResult = { ok: true } | { ok: false; error: PlaylistError };

/** Résultat de recherche dans le catalogue Spotify. */
export type CatalogTrack = {
  spotify_id: string;
  name: string;
  artist: string;
  cover_url: string | null;
  duration_ms: number | null;
};
export type CatalogSearchResult = { ok: true; tracks: CatalogTrack[] } | { ok: false; error: PlaylistError };

/** Morceaux validés, groupés par moment dans l'ordre de la journée ; moments vides omis. */
export function groupBySection(
  tracks: readonly PlaylistTrack[],
): { section: PlaylistSection; tracks: PlaylistTrack[] }[] {
  return PLAYLIST_SECTIONS.map((section) => ({
    section,
    tracks: tracks.filter((track) => track.status === "approved" && track.section === section),
  })).filter((group) => group.tracks.length > 0);
}

/** Durée totale des morceaux validés à jouer (hors « à ne pas passer »), en ms. */
export function playlistDuration(tracks: readonly PlaylistTrack[]): number {
  return tracks
    .filter((track) => track.status === "approved" && track.section !== "do_not_play")
    .reduce((sum, track) => sum + (track.duration_ms ?? 0), 0);
}

/** Durée totale en heures et minutes (arrondie à la minute), minutes sur deux chiffres. */
export function durationParts(ms: number): { hours: number; minutes: string } {
  const total = Math.round(ms / 60_000);
  return { hours: Math.floor(total / 60), minutes: String(total % 60).padStart(2, "0") };
}

/** Durée Spotify (ms) en « 3:27 ». */
export function formatTrackDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

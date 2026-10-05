import { z } from "zod";

/** Bucket Storage privé des photos de la planche (000018). */
export const MOODBOARD_BUCKET = "moodboards";

/** Taille maximale, alignée sur storage.buckets.file_size_limit. */
export const MOODBOARD_MAX_BYTES = 10 * 1024 * 1024;

/** Types acceptés et extension stockée, alignés sur allowed_mime_types. */
export const MOODBOARD_MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type MoodboardMimeType = keyof typeof MOODBOARD_MIME_EXTENSIONS;
export const MOODBOARD_MIME_TYPES = Object.keys(MOODBOARD_MIME_EXTENSIONS) as MoodboardMimeType[];
export const isMoodboardMimeType = (value: string): value is MoodboardMimeType =>
  Object.hasOwn(MOODBOARD_MIME_EXTENSIONS, value);

/** Catégories, alignées sur la contrainte CHECK ; libellés dans Inspiration.moodboard.categories. */
export const MOODBOARD_CATEGORIES = [
  "venue",
  "decor",
  "flowers",
  "attire",
  "beauty",
  "cake",
  "stationery",
  "other",
] as const;
export type MoodboardCategory = (typeof MOODBOARD_CATEGORIES)[number];

export const CAPTION_MAX = 200;

/** Ligne de moodboard_items, telle que lue par la page. */
export type MoodboardItem = {
  id: string;
  kind: "photo" | "pinterest";
  file_path: string | null;
  pinterest_url: string | null;
  caption: string | null;
  category: MoodboardCategory | null;
  created_by: string;
  created_at: string;
};

/** Photo prête à l'affichage (URL signée temporaire). */
export type MoodboardPhoto = MoodboardItem & { kind: "photo"; url: string | null };

const captionSchema = z
  .string()
  .trim()
  .max(CAPTION_MAX)
  .transform((value) => (value === "" ? null : value));

export const itemDetailsSchema = z.object({
  caption: captionSchema,
  category: z.enum(MOODBOARD_CATEGORIES).nullable(),
});
export type ItemDetailsInput = z.input<typeof itemDetailsSchema>;

export const prepareUploadSchema = z.object({
  mimeType: z.enum(MOODBOARD_MIME_TYPES as [MoodboardMimeType, ...MoodboardMimeType[]]),
  size: z.number().int().positive().max(MOODBOARD_MAX_BYTES),
});

export const registerPhotoSchema = itemDetailsSchema.extend({
  path: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/,
    ),
});

export const folderOf = (path: string) => path.split("/")[0];

/**
 * Lien de tableau Pinterest normalisé (« https://www.pinterest.com/user/board/ »),
 * quel que soit le domaine local (pinterest.fr, fr.pinterest.com…). Les liens
 * courts pin.it et les épingles seules ne sont pas des tableaux : null.
 */
export function normalizePinterestBoardUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/^([a-z]{2,3}\.)?pinterest\.[a-z.]{2,6}$/.test(url.hostname)) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2) return null;
  const [user, board] = segments;
  if (["pin", "search", "ideas", "today", "_"].includes(user)) return null;
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(user) || !/^[A-Za-z0-9_.%-]{1,200}$/.test(board)) {
    return null;
  }
  return `https://www.pinterest.com/${user}/${board}/`;
}

export type MoodboardError =
  | "unauthenticated"
  | "forbidden"
  | "invalidType"
  | "tooLarge"
  | "invalidPinterest"
  | "duplicate"
  | "generic";
export type MoodboardResult = { ok: true } | { ok: false; error: MoodboardError };
export type PrepareUploadResult =
  { ok: true; path: string; token: string } | { ok: false; error: MoodboardError };

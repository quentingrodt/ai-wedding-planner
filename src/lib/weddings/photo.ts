import { z } from "zod";

/** Bucket Storage privé des photos du couple (000036). */
export const WEDDING_PHOTO_BUCKET = "wedding-photos";

/** Côté du carré envoyé : assez net pour un portrait de 80 px sur écran dense. */
export const WEDDING_PHOTO_SIZE = 512;

/** Poids maximal du fichier choisi, avant recadrage et compression. */
export const WEDDING_PHOTO_INPUT_MAX_BYTES = 20 * 1024 * 1024;

/** Poids maximal du fichier envoyé, aligné sur storage.buckets.file_size_limit. */
export const WEDDING_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/** Durée de validité des URL signées affichées (secondes). */
export const WEDDING_PHOTO_URL_SECONDS = 60 * 60;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** « <mariage>/<uuid>.jpg », comme la contrainte CHECK de weddings.photo_path. */
export const weddingPhotoPathSchema = z.string().regex(new RegExp(`^${UUID}/${UUID}\\.jpg$`));

/** Dossier (mariage) d'un chemin de photo. */
export const photoFolderOf = (path: string) => path.split("/")[0];

export type WeddingPhotoError = "unauthenticated" | "forbidden" | "invalidType" | "tooLarge" | "generic";
export type WeddingPhotoResult = { ok: true } | { ok: false; error: WeddingPhotoError };
export type PrepareWeddingPhotoResult =
  | { ok: true; path: string; token: string }
  | { ok: false; error: WeddingPhotoError };

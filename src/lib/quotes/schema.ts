import { z } from "zod";
import type { BudgetCategory } from "@/lib/budget/schema";

/** Bucket Storage privé des devis (000004). */
export const QUOTES_BUCKET = "quotes";

/** Taille maximale, alignée sur storage.buckets.file_size_limit. */
export const QUOTE_MAX_BYTES = 10 * 1024 * 1024;

/** Types acceptés et extension du fichier stocké, alignés sur allowed_mime_types. */
export const QUOTE_MIME_EXTENSIONS = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
} as const;
export type QuoteMimeType = keyof typeof QUOTE_MIME_EXTENSIONS;
export const QUOTE_MIME_TYPES = Object.keys(
  QUOTE_MIME_EXTENSIONS,
) as QuoteMimeType[];

export function isQuoteMimeType(value: string): value is QuoteMimeType {
  return Object.hasOwn(QUOTE_MIME_EXTENSIONS, value);
}

export const QUOTE_STATUSES = ["uploaded", "analyzing", "processed", "error"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/** Ligne de la table quotes, telle que lue par la page Devis. */
export type Quote = {
  id: string;
  file_name: string;
  vendor_name: string | null;
  category: BudgetCategory | null;
  status: QuoteStatus;
  total_ttc: number | null;
  created_at: string;
};

// Nom d'origine conservé pour l'affichage uniquement : caractères de contrôle retirés.
const fileNameSchema = z
  .string()
  .transform((value) => value.replace(/[\u0000-\u001f\u007f]/g, "").trim())
  .pipe(z.string().min(1).max(255));

/** Chemin {wedding_id}/{uuid}.{ext}, même forme que la contrainte SQL. */
const QUOTE_PATH_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg)$/;

export function quoteFolderOf(path: string): string | null {
  return QUOTE_PATH_PATTERN.exec(path)?.[1] ?? null;
}

export const prepareQuoteUploadSchema = z.object({
  fileName: fileNameSchema,
  mimeType: z.enum(QUOTE_MIME_TYPES as [QuoteMimeType, ...QuoteMimeType[]]),
  size: z.number().int().positive().max(QUOTE_MAX_BYTES),
});
export type PrepareQuoteUploadInput = z.input<typeof prepareQuoteUploadSchema>;

export const registerQuoteSchema = z.object({
  path: z.string().regex(QUOTE_PATH_PATTERN),
  fileName: fileNameSchema,
});
export type RegisterQuoteInput = z.input<typeof registerQuoteSchema>;

/** Codes d'erreur traduits via Quotes.errors.<code>. */
export type QuoteUploadError =
  | "unauthenticated"
  | "forbidden"
  | "invalidType"
  | "tooLarge"
  | "generic";

export type PrepareQuoteUploadResult =
  | { ok: true; path: string; token: string }
  | { ok: false; error: QuoteUploadError };

export type RegisterQuoteResult =
  | { ok: true }
  | { ok: false; error: QuoteUploadError };

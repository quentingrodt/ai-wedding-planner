import { z } from "zod";
import type { VendorCategory } from "./catalog";

/*
 * Détails propres à chaque catégorie de prestataire (vendors.details, 000032) :
 * modèle et taille d'une robe, type de soin, heures de reportage… et les
 * questions du guide déjà posées à ce prestataire. Libellés traduits côté UI
 * (Vendors.details.<clé>, Vendors.options.<clé>.<valeur>).
 */

export type DetailField =
  | { key: string; kind: "text"; max: number }
  | { key: string; kind: "longText"; max: number }
  | { key: string; kind: "number"; max: number }
  | { key: string; kind: "date" }
  | { key: string; kind: "select"; options: readonly string[] };

const text = (key: string, max = 120): DetailField => ({ key, kind: "text", max });
const longText = (key: string, max = 400): DetailField => ({ key, kind: "longText", max });
const number = (key: string, max: number): DetailField => ({ key, kind: "number", max });
const select = (key: string, options: readonly string[]): DetailField => ({ key, kind: "select", options });

export const SERVICE_STYLES = ["seated", "buffet", "cocktail", "stations"] as const;
export const BEAUTY_TREATMENTS = ["manicure", "waxing", "pedicure", "massage", "facial", "other"] as const;
export const CEREMONY_KINDS = ["secular", "religious"] as const;
export const CAR_BILLINGS = ["duration", "distance", "flat"] as const;
export const ENTERTAINMENT_KINDS = ["dj", "band", "musicians", "magician", "other"] as const;
export const GOWN_SILHOUETTES = ["mermaid", "ballgown", "empire", "sheath", "strapless"] as const;

/** Champs de la fiche, par catégorie, dans l'ordre d'affichage. */
export const DETAIL_FIELDS: Record<VendorCategory, readonly DetailField[]> = {
  catering: [select("serviceStyle", SERVICE_STYLES)],
  florist: [],
  cake: [text("style"), text("flavours"), text("decoration"), number("portions", 2000)],
  hair: [longText("bride", 300), text("bridesmaids"), text("children")],
  makeup: [longText("bride", 300), text("bridesmaids")],
  beauty: [select("treatment", BEAUTY_TREATMENTS)],
  officiant: [select("ceremony", CEREMONY_KINDS), text("thanks")],
  car: [text("vehicles"), select("billing", CAR_BILLINGS), longText("conditions")],
  entertainment: [select("kind", ENTERTAINMENT_KINDS), longText("requirements")],
  guest_gifts: [text("idea")],
  rings: [text("brideRing"), text("groomRing"), text("metal", 60)],
  photographer: [number("hours", 48), number("photos", 10000), number("deliveryWeeks", 104)],
  videographer: [number("hours", 48), number("filmMinutes", 600), number("deliveryWeeks", 104)],
  bridal_gown: [text("model"), select("silhouette", GOWN_SILHOUETTES), text("size", 20)],
  bridesmaids: [text("model"), text("color", 60)],
  groom_suit: [text("model"), text("color", 60)],
  groomsmen: [text("model"), text("color", 60)],
  stationery: [],
  website: [text("platform", 60)],
  honeymoon: [text("destination"), { key: "departure", kind: "date" }, number("nights", 90)],
  other: [],
};

/** Nombre de questions du guide de chaque catégorie (Vendors.categories.<clé>.questions, séparées par « | »). */
export const QUESTION_COUNTS: Record<VendorCategory, number> = {
  catering: 10,
  florist: 10,
  cake: 12,
  hair: 6,
  makeup: 7,
  beauty: 4,
  officiant: 9,
  car: 9,
  entertainment: 5,
  guest_gifts: 4,
  rings: 4,
  photographer: 12,
  videographer: 12,
  bridal_gown: 12,
  bridesmaids: 4,
  groom_suit: 4,
  groomsmen: 4,
  stationery: 4,
  website: 4,
  honeymoon: 5,
  other: 4,
};

export type VendorDetails = { [key: string]: string | number | number[] | undefined; asked?: number[] };

function fieldSchema(field: DetailField) {
  switch (field.kind) {
    case "text":
    case "longText":
      return z.string().trim().max(field.max);
    case "number":
      return z.number().int().min(0).max(field.max);
    case "date":
      return z.iso.date();
    case "select":
      return z.enum(field.options as [string, ...string[]]);
  }
}

/** Schéma des détails d'une catégorie : champs vides retirés, questions posées dédoublonnées. */
export function detailsSchema(category: VendorCategory) {
  const shape = Object.fromEntries(
    DETAIL_FIELDS[category].map((field) => [field.key, fieldSchema(field).optional()]),
  );
  const questions = QUESTION_COUNTS[category];
  return z
    .object({
      ...shape,
      asked: z
        .array(z.number().int().min(0).max(questions - 1))
        .max(questions)
        .optional(),
    })
    .strict()
    .transform((details) => {
      const clean: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(details) as [string, unknown][]) {
        if (value === undefined || value === "") continue;
        if (key === "asked") {
          const asked = [...new Set(value as number[])].sort((a, b) => a - b);
          if (asked.length > 0) clean.asked = asked;
          continue;
        }
        clean[key] = value;
      }
      return clean as VendorDetails;
    });
}

/** Lecture tolérante d'une ligne : une valeur illisible est ignorée, pas la fiche entière. */
export function readDetails(category: VendorCategory, raw: unknown): VendorDetails {
  if (typeof raw !== "object" || raw === null) return {};
  const result: VendorDetails = {};
  const entries = raw as Record<string, unknown>;
  for (const field of DETAIL_FIELDS[category]) {
    const parsed = fieldSchema(field).safeParse(entries[field.key]);
    if (parsed.success && parsed.data !== "") result[field.key] = parsed.data;
  }
  const asked = z.array(z.number().int().min(0).max(QUESTION_COUNTS[category] - 1)).safeParse(entries.asked);
  if (asked.success && asked.data.length > 0) result.asked = asked.data;
  return result;
}

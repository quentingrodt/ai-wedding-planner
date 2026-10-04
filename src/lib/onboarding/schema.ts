import { z } from "zod";
import {
  BUDGET_RANGE,
  GUESTS_RANGE,
  WEDDING_STYLES,
} from "@/lib/date-night/schema";
import {
  INSPIRATION_OPTIONS,
  inspirationLikesSchema,
  type DateNightLikes,
} from "@/lib/inspiration/catalog";

// -----------------------------------------------------------------------------
// Passage de relais Date Night → Login → Auth Callback → Onboarding
// -----------------------------------------------------------------------------

/**
 * Paramètres d'URL transmis tout au long du tunnel (liste blanche). Les
 * coups de cœur du swipe voyagent en listes séparées par des virgules
 * (`venue=chateau,beach`), forme que produit directement String(array).
 */
export const HANDOFF_KEYS = ["budget", "guests", "style", "venue", "ceremony", "reception"] as const;

/** Liste « a,b » tolérante : valeurs inconnues et doublons ignorés. */
const likesParam = <T extends readonly [string, ...string[]]>(options: T) =>
  z
    .string()
    .optional()
    .transform((raw) => {
      const values = [...new Set(raw?.split(",") ?? [])].filter((value): value is T[number] =>
        (options as readonly string[]).includes(value),
      );
      return values.length > 0 ? values : undefined;
    })
    .catch(undefined)
    .optional();

/**
 * Lecture tolérante des searchParams : une valeur absente ou invalide est
 * ignorée (jamais d'erreur), les autres sont conservées.
 */
export const handoffSchema = z.object({
  budget: z.coerce
    .number()
    .int()
    .min(BUDGET_RANGE.min)
    .max(BUDGET_RANGE.max)
    .optional()
    .catch(undefined),
  guests: z.coerce
    .number()
    .int()
    .min(GUESTS_RANGE.min)
    .max(GUESTS_RANGE.max)
    .optional()
    .catch(undefined),
  style: z.enum(WEDDING_STYLES).optional().catch(undefined),
  venue: likesParam(INSPIRATION_OPTIONS.venue),
  ceremony: likesParam(INSPIRATION_OPTIONS.ceremony),
  reception: likesParam(INSPIRATION_OPTIONS.reception),
});
export type Handoff = z.infer<typeof handoffSchema>;

type RawParams =
  | Record<string, string | string[] | undefined>
  | URLSearchParams
  | FormData;

/** Extrait le relais depuis des searchParams, une URLSearchParams ou un FormData. */
export function parseHandoff(source: RawParams): Handoff {
  const read = (key: string): unknown => {
    if (source instanceof URLSearchParams || source instanceof FormData) {
      return source.get(key) ?? undefined;
    }
    const value = source[key];
    return Array.isArray(value) ? value[0] : value;
  };
  return handoffSchema.parse(
    Object.fromEntries(HANDOFF_KEYS.map((key) => [key, read(key)])),
  );
}

/** Query string du relais, sans "?" ; vide si aucun paramètre valide. */
export function toHandoffQuery(handoff: Handoff): string {
  const params = new URLSearchParams();
  for (const key of HANDOFF_KEYS) {
    const value = handoff[key];
    if (value !== undefined) params.set(key, String(value));
  }
  return params.toString();
}

/** Ajoute le relais (et d'éventuels paramètres en plus) à un chemin. */
export function withHandoff(
  path: string,
  handoff: Handoff,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams(extra);
  new URLSearchParams(toHandoffQuery(handoff)).forEach((value, key) =>
    params.set(key, value),
  );
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

// -----------------------------------------------------------------------------
// Formulaire d'onboarding
// -----------------------------------------------------------------------------

/** Bornes du formulaire, plus larges que celles du tunnel Date Night. */
export const ONBOARDING_BUDGET = { min: 1_000, max: 1_000_000, step: 100 } as const;
export const ONBOARDING_GUESTS = { min: 1, max: 2_000 } as const;

/** Devise et pays du marché de lancement, en attendant un sélecteur dédié. */
export const DEFAULT_CURRENCY = "EUR";
export const DEFAULT_COUNTRY = "FR";

/**
 * "Style DNA" stocké en JSONB : versionné pour pouvoir l'enrichir sans
 * migration. v2 : ambiance principale + coups de cœur du swipe par étape
 * (v1 ne contenait que l'ambiance).
 */
export const styleDnaSchema = z.object({
  version: z.literal(2),
  ambiance: z.enum(WEDDING_STYLES),
  likes: inspirationLikesSchema,
});
export type StyleDna = z.infer<typeof styleDnaSchema>;

/** Coups de cœur Date Night extraits du relais, prêts pour le Style DNA. */
export function likesFromHandoff(handoff: Handoff): DateNightLikes {
  return {
    ...(handoff.venue && { venue: handoff.venue }),
    ...(handoff.ceremony && { ceremony: handoff.ceremony }),
    ...(handoff.reception && { reception: handoff.reception }),
  };
}

/** Date du jour (UTC) au format ISO, moins un jour pour absorber les fuseaux. */
function earliestWeddingDate(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export const onboardingSchema = z.object({
  coupleNames: z.string().trim().min(1, "required").max(200, "tooLong"),
  weddingDate: z.iso
    .date("invalidDate")
    .refine((value) => value >= earliestWeddingDate(), "pastDate"),
  budget: z.coerce
    .number("invalidNumber")
    .int("invalidNumber")
    .min(ONBOARDING_BUDGET.min, "budgetRange")
    .max(ONBOARDING_BUDGET.max, "budgetRange"),
  guests: z.coerce
    .number("invalidNumber")
    .int("invalidNumber")
    .min(ONBOARDING_GUESTS.min, "guestsRange")
    .max(ONBOARDING_GUESTS.max, "guestsRange"),
  style: z.enum(WEDDING_STYLES, "required"),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export type OnboardingField = keyof OnboardingInput;
export type OnboardingFieldError =
  | "required"
  | "tooLong"
  | "invalidDate"
  | "pastDate"
  | "invalidNumber"
  | "budgetRange"
  | "guestsRange";

/** État renvoyé par la Server Action ; les messages sont traduits côté UI. */
export type OnboardingState =
  | { status: "idle" }
  | {
      status: "error";
      code: "invalidInput" | "generic";
      fieldErrors?: Partial<Record<OnboardingField, OnboardingFieldError>>;
      /** Valeurs saisies, réinjectées dans le formulaire après une erreur. */
      values?: Partial<Record<OnboardingField, string>>;
    };

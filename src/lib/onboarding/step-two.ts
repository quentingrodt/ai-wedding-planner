import { z } from "zod";
import { GUEST_LIMITS } from "@/lib/guests/schema";
import { normalizePinterestBoardUrl } from "@/lib/moodboard/schema";
import {
  ATTIRE_CHOICES,
  DEFAULT_PLANNING_ANSWERS,
  MUSIC_CHOICES,
  type PlanningAnswers,
} from "@/lib/planning/schema";
import type { VendorCategory } from "@/lib/vendors/catalog";
import { VENDOR_LIMITS } from "@/lib/vendors/schema";
import { VENUE_LIMITS } from "@/lib/venues/schema";

/*
 * Étape 2 de l'onboarding : une revue légère de chaque poste pour préremplir
 * l'espace de travail. Tout est facultatif ; seules les réponses données
 * créent quelque chose (fiches, invités, planche, rétroplanning).
 */

/** Cérémonies prévues en plus de la mairie : elles ajoutent leurs étapes au rétroplanning. */
export const CEREMONY_TYPES = ["civil", "religious", "secular", "both"] as const;
export type CeremonyType = (typeof CEREMONY_TYPES)[number];

/** Postes passés en revue au bloc 4, dans l'ordre où ils se réservent. */
export const STEP_TWO_VENDORS = ["catering", "entertainment", "photographer", "florist"] as const satisfies readonly VendorCategory[];
export type StepTwoVendor = (typeof STEP_TWO_VENDORS)[number];

/** Lieux et invités saisis ici : de quoi démarrer, pas un import complet. */
export const STEP_TWO_LIMITS = { venues: 3, guests: 300 } as const;

/** Montant facultatif saisi en texte (« 4 500 ») ; vide → null. */
const optionalAmount = z
  .string()
  .transform((value) => value.replace(/[\s  ]/g, ""))
  .pipe(z.union([z.literal(""), z.string().regex(/^\d+$/, "invalidAmount")]))
  .transform((value) => (value === "" ? null : Number(value)))
  .pipe(z.number().int().max(VENDOR_LIMITS.price, "invalidAmount").nullable());

export const stepTwoSchema = z.object({
  planning: z.object({
    ceremony: z.enum(CEREMONY_TYPES),
    music: z.enum(MUSIC_CHOICES),
    attire: z.enum(ATTIRE_CHOICES),
    guestAccommodation: z.boolean(),
  }),
  pinterestUrl: z
    .string()
    .trim()
    .transform((value, context) => {
      if (value === "") return null;
      const normalized = normalizePinterestBoardUrl(value);
      if (!normalized) {
        context.addIssue({ code: "custom", message: "invalidPinterest" });
        return z.NEVER;
      }
      return normalized;
    }),
  venues: z.object({
    enabled: z.boolean(),
    names: z.array(z.string().trim().max(VENUE_LIMITS.name, "tooLong")).max(STEP_TWO_LIMITS.venues),
  }),
  vendors: z.object(
    Object.fromEntries(
      STEP_TWO_VENDORS.map((category) => [
        category,
        z.object({
          enabled: z.boolean(),
          name: z.string().trim().max(VENDOR_LIMITS.name, "tooLong"),
          budget: optionalAmount,
        }),
      ]),
    ) as Record<
      StepTwoVendor,
      z.ZodObject<{ enabled: z.ZodBoolean; name: z.ZodString; budget: typeof optionalAmount }>
    >,
  ),
  guests: z.object({
    enabled: z.boolean(),
    list: z.string().max(20_000, "tooLong"),
  }),
});
export type StepTwoInput = z.input<typeof stepTwoSchema>;
export type StepTwoData = z.output<typeof stepTwoSchema>;

export type StepTwoFieldError = "invalidPinterest" | "invalidAmount" | "tooLong" | "tooManyGuests";

export type StepTwoResult =
  | { ok: true }
  | { ok: false; error: "unauthenticated" | "forbidden" | "generic" }
  | { ok: false; error: "invalid"; fieldErrors: Record<string, StepTwoFieldError> }
  /** Enregistré en partie : la liste des blocs qui ont échoué. */
  | { ok: false; error: "partial"; failed: StepTwoBlock[] };

export type StepTwoBlock = "planning" | "pinterest" | "venues" | "vendors" | "guests";

/** Valeurs de départ : les réponses déjà connues, sinon celles supposées par défaut. */
export function initialStepTwo(answers: PlanningAnswers | null): StepTwoInput {
  const current = answers ?? DEFAULT_PLANNING_ANSWERS;
  return {
    planning: {
      ceremony: ceremonyOf(current),
      music: current.music,
      attire: current.attire,
      guestAccommodation: current.guestAccommodation,
    },
    pinterestUrl: "",
    venues: { enabled: false, names: ["", "", ""] },
    vendors: Object.fromEntries(
      STEP_TWO_VENDORS.map((category) => [category, { enabled: false, name: "", budget: "" }]),
    ) as StepTwoInput["vendors"],
    guests: { enabled: false, list: "" },
  };
}

export function ceremonyOf(answers: Pick<PlanningAnswers, "religiousCeremony" | "secularCeremony">): CeremonyType {
  if (answers.religiousCeremony && answers.secularCeremony) return "both";
  if (answers.religiousCeremony) return "religious";
  if (answers.secularCeremony) return "secular";
  return "civil";
}

/** Réponses du questionnaire du rétroplanning, mises à jour avec celles de l'étape 2. */
export function mergePlanningAnswers(
  current: PlanningAnswers | null,
  planning: StepTwoData["planning"],
): PlanningAnswers {
  return {
    ...(current ?? DEFAULT_PLANNING_ANSWERS),
    religiousCeremony: planning.ceremony === "religious" || planning.ceremony === "both",
    secularCeremony: planning.ceremony === "secular" || planning.ceremony === "both",
    music: planning.music,
    attire: planning.attire,
    guestAccommodation: planning.guestAccommodation,
  };
}

/**
 * Une ligne par invité : le premier mot est le prénom, la suite le nom.
 * Lignes vides ignorées ; les virgules et points-virgules séparent aussi.
 */
export function parseGuestList(list: string): { firstName: string; lastName: string | null }[] {
  return list
    .split(/[\n,;]+/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .map((line) => {
      const [first, ...rest] = line.split(" ");
      return {
        firstName: first.slice(0, GUEST_LIMITS.firstName),
        lastName: rest.length > 0 ? rest.join(" ").slice(0, GUEST_LIMITS.lastName) : null,
      };
    });
}

/** Noms de lieux saisis, sans doublon ni case vide. */
export const venueNames = (names: readonly string[]) =>
  [...new Set(names.map((name) => name.trim()).filter(Boolean))];

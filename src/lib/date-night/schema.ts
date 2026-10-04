import { z } from "zod";
import { INSPIRATION_OPTIONS } from "@/lib/inspiration/catalog";

/** Ambiances de lieu : la préférence principale sert au Reality Check. */
export const WEDDING_STYLES = INSPIRATION_OPTIONS.venue;
export type WeddingStyle = (typeof WEDDING_STYLES)[number];

export const BUDGET_RANGE = {
  min: 5_000,
  max: 100_000,
  step: 1_000,
  defaultValue: 25_000,
} as const;

export const GUESTS_RANGE = {
  min: 20,
  max: 300,
  step: 5,
  defaultValue: 100,
} as const;

/** Le marché de lancement est la France : le tunnel est chiffré en euros. */
export const DATE_NIGHT_CURRENCY = "EUR";

/** Entrée du Reality Check, revalidée côté serveur (route publique). */
export const dateNightInputSchema = z.object({
  style: z.enum(WEDDING_STYLES),
  budget: z.int().min(BUDGET_RANGE.min).max(BUDGET_RANGE.max),
  guests: z.int().min(GUESTS_RANGE.min).max(GUESTS_RANGE.max),
});
export type DateNightInput = z.infer<typeof dateNightInputSchema>;

export const FEASIBILITY_VERDICTS = [
  "comfortable",
  "tight",
  "challenging",
] as const;
export type FeasibilityVerdict = (typeof FEASIBILITY_VERDICTS)[number];

/** Chiffres calculés en TypeScript (jamais par l'IA). */
export type Feasibility = {
  verdict: FeasibilityVerdict;
  budgetPerGuest: number;
  marketPerGuest: number;
  /** Part du coût moyen du marché couverte par le budget (1 = 100 %). */
  coverage: number;
  /** Nombre d'invités que le budget couvre au prix moyen du marché. */
  affordableGuests: number;
};

/**
 * Sortie structurée de l'agent IA : uniquement du texte rédigé.
 * Ce schéma servira tel quel de Structured Output lors du branchement réel.
 */
export const realityCheckInsightSchema = z.object({
  headline: z.string().min(1),
  summary: z.string().min(1),
  tips: z
    .array(
      z.object({
        title: z.string().min(1),
        body: z.string().min(1),
      }),
    )
    .length(2),
});
export type RealityCheckInsight = z.infer<typeof realityCheckInsightSchema>;

export type RealityCheckErrorCode = "invalidInput" | "generic";

/** Réponse de la Server Action ; les erreurs sont traduites côté UI. */
export type RealityCheckResponse =
  | {
      status: "success";
      input: DateNightInput;
      feasibility: Feasibility;
      insight: RealityCheckInsight;
    }
  | { status: "error"; code: RealityCheckErrorCode };

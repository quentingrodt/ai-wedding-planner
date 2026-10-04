import { calculateBudgetVentilation, type BudgetItem } from "@/lib/budget/ventilation";
import type { InspirationLikes, InspirationOption } from "@/lib/inspiration/catalog";

/**
 * Postes de prestataires du plan, alignés sur VENDOR_DICTIONARY
 * (src/lib/budget/ventilation.ts) avec des clés stables, traduites côté UI.
 */
export const PLAN_VENDORS = [
  "venue",
  "catering",
  "honeymoon",
  "attire",
  "photographer",
  "videographer",
  "florist",
  "music",
  "partyRental",
  "rings",
  "weddingCake",
  "stationery",
  "transport",
  "officiant",
  "hairdresser",
  "makeup",
  "beauty",
  "tech",
] as const;
export type PlanVendor = (typeof PLAN_VENDORS)[number];

/** Poids relatifs du marché (mêmes valeurs que VENDOR_DICTIONARY). */
const BASE_WEIGHTS: Record<PlanVendor, number> = {
  venue: 35,
  catering: 30,
  honeymoon: 15,
  attire: 10,
  photographer: 8,
  videographer: 7,
  florist: 6,
  music: 5,
  partyRental: 4,
  rings: 3,
  weddingCake: 3,
  stationery: 2,
  transport: 2,
  officiant: 2,
  hairdresser: 2,
  makeup: 2,
  beauty: 1,
  tech: 1,
};

/** Part verrouillée pour les imprévus, comme dans calculateBudgetVentilation. */
export const CONTINGENCY_SHARE = 0.12;

const first = <T>(values: readonly T[] | undefined) => values?.[0];
const has = <T>(values: readonly T[] | undefined, value: T) => values?.includes(value) ?? false;

const VENUE_WEIGHT: Record<InspirationOption<"venue">, number> = {
  chateau: 38,
  countryside: 34,
  beach: 32,
  urban: 30,
};
const CATERING_WEIGHT: Record<InspirationOption<"reception">, number> = {
  seated: 32,
  family: 28,
  cocktail: 26,
  foodTrucks: 24,
};
const TRANSPORT_WEIGHT: Record<InspirationOption<"transport">, number> = {
  luxury: 4,
  carriage: 3,
  shuttle: 3,
  vintage: 2,
};

/**
 * Poids de chaque poste d'après le carnet : 0 désactive le poste. Hypothèses
 * de marché volontairement simples, à affiner avec des données réelles.
 * L'EVJF et l'EVG ne sont pas comptés : ils sont pris en charge par les proches.
 */
export function vendorWeights(likes: InspirationLikes): Record<PlanVendor, number> {
  const venue = first(likes.venue);
  const reception = first(likes.reception);
  const transport = likes.transport ?? [];

  return {
    ...BASE_WEIGHTS,
    venue: venue ? VENUE_WEIGHT[venue] : BASE_WEIGHTS.venue,
    catering: reception ? CATERING_WEIGHT[reception] : BASE_WEIGHTS.catering,
    // Pas de voyage, de transport ou de dessert retenu : poste désactivé.
    honeymoon: likes.honeymoon?.length ? BASE_WEIGHTS.honeymoon : 0,
    transport: transport.length ? Math.max(...transport.map((t) => TRANSPORT_WEIGHT[t])) : 0,
    weddingCake: !likes.dessert?.length ? 0 : has(likes.dessert, "dessertBar") ? 4 : 3,
    // Seule une cérémonie laïque demande un officiant rémunéré.
    officiant: has(likes.ceremony, "secular") ? BASE_WEIGHTS.officiant : 0,
    // Domaine champêtre et plage : location de mobilier, tentes, vaisselle.
    partyRental: venue === "countryside" || venue === "beach" ? 6 : BASE_WEIGHTS.partyRental,
    attire:
      BASE_WEIGHTS.attire +
      (has(likes.brideAttire, "princess") ? 2 : 0) +
      (has(likes.groomAttire, "tuxedo") || has(likes.groomAttire, "velvet") ? 1 : 0),
  };
}

export type PlanAllocation = {
  total: number;
  contingency: number;
  /** Postes activés, du plus gros au plus petit. */
  lines: { vendor: PlanVendor; amount: number }[];
};

/** Répartit le budget total selon le carnet (calcul en TypeScript, jamais par l'IA). */
export function allocateBudget(totalBudget: number, likes: InspirationLikes): PlanAllocation {
  const weights = vendorWeights(likes);
  const items: BudgetItem[] = PLAN_VENDORS.map((vendor) => ({
    id: vendor,
    name: vendor,
    isEnabled: weights[vendor] > 0,
    sourcingType: "undecided",
    defaultWeight: weights[vendor],
  }));

  const result = calculateBudgetVentilation(totalBudget, items, CONTINGENCY_SHARE);
  return {
    total: totalBudget,
    contingency: result.contingencyReserve,
    lines: result.allocations
      .map(({ id, allocatedAmount }) => ({ vendor: id as PlanVendor, amount: allocatedAmount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

import type {
  DateNightInput,
  Feasibility,
  FeasibilityVerdict,
  WeddingStyle,
} from "./schema";

/**
 * Coût moyen tout compris par invité (lieu, traiteur, boissons, décoration),
 * en euros, pour le marché français. Valeurs indicatives, à remplacer par
 * des données de marché réelles.
 */
const MARKET_COST_PER_GUEST: Record<WeddingStyle, number> = {
  chateau: 190,
  beach: 140,
  urban: 120,
};

const COMFORTABLE_COVERAGE = 1.1;
const TIGHT_COVERAGE = 0.75;

function verdictFor(coverage: number): FeasibilityVerdict {
  if (coverage >= COMFORTABLE_COVERAGE) return "comfortable";
  if (coverage >= TIGHT_COVERAGE) return "tight";
  return "challenging";
}

export function assessFeasibility({
  style,
  budget,
  guests,
}: DateNightInput): Feasibility {
  const marketPerGuest = MARKET_COST_PER_GUEST[style];
  const coverage = budget / (marketPerGuest * guests);

  return {
    verdict: verdictFor(coverage),
    budgetPerGuest: Math.round(budget / guests),
    marketPerGuest,
    coverage,
    affordableGuests: Math.floor(budget / marketPerGuest),
  };
}

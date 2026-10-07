import type { BudgetItem } from "@/lib/budget/schema";
import { DEFAULT_BUDGET_SPLIT } from "@/lib/budget/schema";
import { VENUE_CRITERIA, type VenueCriterion } from "./catalog";
import { ratingOf, type Venue } from "./schema";

/*
 * Comparaison des lieux : tout est calculé ici, à partir des faits saisis par
 * les mariés et des données du mariage (invités, budget, ambiance).
 */

/** Ce que l'on sait du mariage pour confronter chaque lieu. */
export type VenueContext = {
  /** Nombre d'invités attendus, ou null s'il est inconnu. */
  guestCount: number | null;
  /** Enveloppe prévue pour le lieu, ou null sans budget. */
  venueBudget: number | null;
  /** Ambiance de référence du carnet d'inspiration. */
  ambiance: string | null;
};

/** Note moyenne des critères notés (1 à 5, au dixième), et nombre de critères notés. */
export function venueScore(venue: Venue): { score: number | null; rated: number } {
  const ratings = VENUE_CRITERIA.map((criterion) => ratingOf(venue, criterion)).filter(
    (rating): rating is number => rating !== null,
  );
  if (ratings.length === 0) return { score: null, rated: 0 };
  const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
  return { score: Math.round(average * 10) / 10, rated: ratings.length };
}

/** Constat sur un critère : « good » rassure, « watch » mérite une question au lieu. */
export type VenueCheck =
  | { criterion: "capacity"; tone: "good"; key: "fits"; spare: number }
  | { criterion: "capacity"; tone: "watch"; key: "tooSmall"; missing: number }
  | { criterion: "budget"; tone: "good"; key: "withinBudget"; left: number }
  | { criterion: "budget"; tone: "watch"; key: "overBudget"; over: number }
  | { criterion: "style"; tone: "good"; key: "matchesStyle" }
  | { criterion: "accommodation"; tone: "good"; key: "everyoneSleeps" }
  | { criterion: "accommodation"; tone: "watch"; key: "noBeds" }
  | { criterion: "service"; tone: "watch"; key: "imposedCaterer" }
  | { criterion: "restrictions"; tone: "watch"; key: "earlyCurfew"; time: string }
  | { criterion: "flexibility"; tone: "good"; key: "dateFree" }
  | { criterion: "flexibility"; tone: "watch"; key: "otherDates" }
  | { criterion: "flexibility"; tone: "watch"; key: "dateTaken" };

/** Heure de fin « HH:MM » ; avant minuit (entre midi et 23 h 59), la soirée sera écourtée. */
export function isEarlyCurfew(curfew: string): boolean {
  const hour = Number.parseInt(curfew.slice(0, 2), 10);
  return hour >= 12 && hour <= 23;
}

/** Constats objectifs d'un lieu, dans l'ordre des critères. */
export function venueChecks(venue: Venue, context: VenueContext): VenueCheck[] {
  const checks: VenueCheck[] = [];
  const { guestCount, venueBudget, ambiance } = context;

  if (venue.capacity !== null && guestCount !== null) {
    checks.push(
      venue.capacity >= guestCount
        ? { criterion: "capacity", tone: "good", key: "fits", spare: venue.capacity - guestCount }
        : { criterion: "capacity", tone: "watch", key: "tooSmall", missing: guestCount - venue.capacity },
    );
  }
  if (venue.price !== null && venueBudget !== null) {
    checks.push(
      venue.price <= venueBudget
        ? { criterion: "budget", tone: "good", key: "withinBudget", left: venueBudget - venue.price }
        : { criterion: "budget", tone: "watch", key: "overBudget", over: venue.price - venueBudget },
    );
  }
  if (venue.style !== null && venue.style === ambiance) {
    checks.push({ criterion: "style", tone: "good", key: "matchesStyle" });
  }
  if (venue.beds !== null) {
    if (venue.beds === 0 && venue.accommodation_note === null) {
      checks.push({ criterion: "accommodation", tone: "watch", key: "noBeds" });
    } else if (guestCount !== null && venue.beds >= guestCount) {
      checks.push({ criterion: "accommodation", tone: "good", key: "everyoneSleeps" });
    }
  }
  if (venue.catering === "imposed") {
    checks.push({ criterion: "service", tone: "watch", key: "imposedCaterer" });
  }
  if (venue.curfew !== null && isEarlyCurfew(venue.curfew)) {
    checks.push({ criterion: "restrictions", tone: "watch", key: "earlyCurfew", time: venue.curfew.slice(0, 5) });
  }
  if (venue.date_status === "available") checks.push({ criterion: "flexibility", tone: "good", key: "dateFree" });
  if (venue.date_status === "alternatives") checks.push({ criterion: "flexibility", tone: "watch", key: "otherDates" });
  if (venue.date_status === "unavailable") checks.push({ criterion: "flexibility", tone: "watch", key: "dateTaken" });
  return checks;
}

const VENUE_SHARE = DEFAULT_BUDGET_SPLIT.find(({ category }) => category === "venue")?.share ?? 0.4;

/**
 * Enveloppe du lieu : les lignes « lieu » du budget si le couple les a
 * chiffrées, sinon la part habituelle du budget total.
 */
export function venueBudgetEnvelope(
  items: readonly Pick<BudgetItem, "category" | "estimated_amount">[],
  totalBudget: number | null,
): number | null {
  const planned = items
    .filter((item) => item.category === "venue")
    .reduce((sum, item) => sum + item.estimated_amount, 0);
  if (planned > 0) return planned;
  return totalBudget ? Math.round(totalBudget * VENUE_SHARE) : null;
}

/** Invités attendus : la liste si elle est plus fournie que l'estimation de l'onboarding. */
export function expectedGuests(listedGuests: number, estimate: number | null): number | null {
  const count = Math.max(listedGuests, estimate ?? 0);
  return count > 0 ? count : null;
}

/** Pour chaque critère, la meilleure note parmi les lieux comparés (null si aucun n'est noté). */
export function bestRatings(venues: readonly Venue[]): Record<VenueCriterion, number | null> {
  return Object.fromEntries(
    VENUE_CRITERIA.map((criterion) => {
      const ratings = venues.map((venue) => ratingOf(venue, criterion)).filter((r): r is number => r !== null);
      return [criterion, ratings.length > 0 ? Math.max(...ratings) : null];
    }),
  ) as Record<VenueCriterion, number | null>;
}

const STATUS_ORDER = { booked: 0, shortlisted: 1, visited: 2, contacted: 3, idea: 4, declined: 5 } as const;

/** Ordre d'affichage : le lieu retenu, puis par avancement, puis par note décroissante. */
export function sortVenues(venues: readonly Venue[]): Venue[] {
  return [...venues].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    const byScore = (venueScore(b).score ?? 0) - (venueScore(a).score ?? 0);
    return byScore !== 0 ? byScore : a.position - b.position;
  });
}

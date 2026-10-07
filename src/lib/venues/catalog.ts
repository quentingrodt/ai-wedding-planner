/*
 * Lieu de réception : les huit critères qui départagent les lieux envisagés,
 * et les valeurs des listes de la table venues (000027_venues.sql).
 * Les libellés sont traduits côté UI (Venues.*).
 */

/** Critères de choix, dans l'ordre où le couple les découvre. */
export const VENUE_CRITERIA = [
  "location",
  "capacity",
  "budget",
  "style",
  "accommodation",
  "service",
  "restrictions",
  "flexibility",
] as const;
export type VenueCriterion = (typeof VENUE_CRITERIA)[number];

/** Colonne de la note de chaque critère (venues.rating_*). */
export const RATING_COLUMNS = {
  location: "rating_location",
  capacity: "rating_capacity",
  budget: "rating_budget",
  style: "rating_style",
  accommodation: "rating_accommodation",
  service: "rating_service",
  restrictions: "rating_restrictions",
  flexibility: "rating_flexibility",
} as const satisfies Record<VenueCriterion, `rating_${string}`>;
export type RatingColumn = (typeof RATING_COLUMNS)[VenueCriterion];

/** Avancement d'un lieu, du premier repérage au choix final. */
export const VENUE_STATUSES = ["idea", "contacted", "visited", "shortlisted", "booked", "declined"] as const;
export type VenueStatus = (typeof VENUE_STATUSES)[number];

/** Ambiances, alignées sur private.is_venue_style ; les quatre premières sont celles du carnet d'inspiration. */
export const VENUE_STYLES = ["chateau", "countryside", "beach", "urban", "barn", "garden", "restaurant", "other"] as const;
export type VenueStyle = (typeof VENUE_STYLES)[number];

export const VENUE_CATERINGS = ["included", "imposed", "free"] as const;
export type VenueCatering = (typeof VENUE_CATERINGS)[number];

export const VENUE_DATE_STATUSES = ["available", "alternatives", "unavailable"] as const;
export type VenueDateStatus = (typeof VENUE_DATE_STATUSES)[number];

export const RATING_MAX = 5;

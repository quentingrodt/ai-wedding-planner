/*
 * Hébergement des invités : valeurs des listes de guest_lodgings
 * (000028_guest_lodging.sql) et repères du marché. Libellés traduits côté UI
 * (Lodging.*).
 */

/** Types d'hébergement ; les derniers sont les alternatives économiques. */
export const LODGING_KINDS = ["hotel", "guesthouse", "gite", "rental", "camping", "venue", "family", "other"] as const;
export type LodgingKind = (typeof LODGING_KINDS)[number];

/** Avancement, du repérage au bloc de chambres confirmé. */
export const LODGING_STATUSES = ["idea", "contacted", "option", "confirmed", "declined"] as const;
export type LodgingStatus = (typeof LODGING_STATUSES)[number];

/** Statuts où des chambres sont tenues pour les invités. */
export const SECURED_STATUSES: readonly LodgingStatus[] = ["option", "confirmed"];

/** Les quatre astuces, dans l'ordre où elles se jouent. */
export const LODGING_TIPS = ["bookEarly", "groupRate", "compare", "budget"] as const;
export type LodgingTip = (typeof LODGING_TIPS)[number];

/** Les hôtels accordent en général un tarif de groupe à partir de 10 chambres, parfois dès 5. */
export const GROUP_RATE_ROOMS = 10;
export const GROUP_RATE_MIN_ROOMS = 5;

/** Bloquer les chambres 9 mois avant ; les hôtels libèrent souvent le bloc 6 semaines avant. */
export const BLOCK_ROOMS_DAYS = 270;
export const LATE_BOOKING_DAYS = 90;
export const GUESTS_BOOK_BY_DAYS = 45;

/** Une option qui expire sous 14 jours mérite une relance. */
export const DEADLINE_SOON_DAYS = 14;

/** Au-delà de 20 minutes de route, une navette évite de prendre le volant après la soirée. */
export const SHUTTLE_MINUTES = 20;

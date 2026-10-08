/*
 * En-tête de l'accueil : la phase de préparation et le chemin parcouru.
 * Calcul pur, sans requête ni traduction.
 */

/** Phases, de la plus lointaine à la plus proche, avec le nombre de jours où chacune commence. */
export const WEDDING_PHASES = [
  { key: "foundations", fromDays: Number.POSITIVE_INFINITY },
  { key: "bookings", fromDays: 365 },
  { key: "details", fromDays: 180 },
  { key: "finalStretch", fromDays: 30 },
] as const;
export type WeddingPhase = (typeof WEDDING_PHASES)[number]["key"];

/** Phase selon le temps restant ; null sans date ou une fois le mariage passé. */
export function weddingPhase(daysLeft: number | null): WeddingPhase | null {
  if (daysLeft === null || daysLeft < 0) return null;
  // La dernière phase dont le seuil est encore au-dessus du temps restant.
  return WEDDING_PHASES.findLast((phase) => daysLeft <= phase.fromDays)?.key ?? null;
}

export type TaskProgress = { done: number; total: number };

/** Part des étapes terminées, dans [0, 1] ; null sans aucune étape. */
export function progressRatio({ done, total }: TaskProgress): number | null {
  if (total <= 0) return null;
  return Math.min(Math.max(done / total, 0), 1);
}

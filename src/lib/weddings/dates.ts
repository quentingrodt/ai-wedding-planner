const DAY_MS = 86_400_000;

/** Date ISO (YYYY-MM-DD) → timestamp UTC à minuit, sans dépendre du fuseau serveur. */
function toUtcMs(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`);
}

/** Ajoute (ou retranche) des jours à une date ISO ; renvoie une date ISO. */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  return new Date(toUtcMs(isoDate) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Date du jour (UTC) au format ISO. */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Nombre de jours entiers de `from` à `to` (négatif si `to` est passé). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/** Date ISO → Date à minuit UTC, pour Intl.DateTimeFormat avec timeZone "UTC". */
export function isoDateToUtc(isoDate: string): Date {
  return new Date(toUtcMs(isoDate));
}

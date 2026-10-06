import { addDaysToIsoDate, isoDateToUtc } from "@/lib/weddings/dates";

/*
 * Grille mensuelle du calendrier (écran et export PDF) : semaines du lundi au
 * dimanche, dates ISO en UTC pour ne jamais dépendre du fuseau.
 * Un mois est désigné par sa clé « YYYY-MM ».
 */

export type MonthKey = string;

export const monthKeyOf = (isoDate: string): MonthKey => isoDate.slice(0, 7);

/** Premier jour du mois (ISO). */
export const firstDayOf = (month: MonthKey): string => `${month}-01`;

/** Décale une clé de mois de `count` mois. */
export function addMonths(month: MonthKey, count: number): MonthKey {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 1 + count, 1));
  return date.toISOString().slice(0, 7);
}

/** Mois de `from` à `to` inclus (clés « YYYY-MM »), dans l'ordre. */
export function monthsBetween(from: MonthKey, to: MonthKey): MonthKey[] {
  const months: MonthKey[] = [];
  for (let month = from; month <= to; month = addMonths(month, 1)) months.push(month);
  return months;
}

/** Jour de la semaine, lundi = 0 … dimanche = 6. */
const weekdayIndex = (isoDate: string) => (isoDateToUtc(isoDate).getUTCDay() + 6) % 7;

export type MonthCell = { date: string; inMonth: boolean };

/**
 * Semaines complètes couvrant le mois (4 à 6), lundi en premier ; les jours
 * des mois voisins sont marqués inMonth: false.
 */
export function monthGrid(month: MonthKey): MonthCell[][] {
  const first = firstDayOf(month);
  let cursor = addDaysToIsoDate(first, -weekdayIndex(first));
  const weeks: MonthCell[][] = [];
  do {
    const week: MonthCell[] = [];
    for (let day = 0; day < 7; day++) {
      week.push({ date: cursor, inMonth: monthKeyOf(cursor) === month });
      cursor = addDaysToIsoDate(cursor, 1);
    }
    weeks.push(week);
  } while (monthKeyOf(cursor) === month);
  return weeks;
}

/** Les 7 dates d'une semaine type (lundi → dimanche), pour formater les en-têtes. */
export const WEEKDAY_SAMPLE = Array.from({ length: 7 }, (_, i) =>
  addDaysToIsoDate("2024-01-01", i),
);

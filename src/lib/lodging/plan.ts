import type { Guest } from "@/lib/guests/schema";
import { addDaysToIsoDate, daysBetween } from "@/lib/weddings/dates";
import {
  BLOCK_ROOMS_DAYS,
  DEADLINE_SOON_DAYS,
  GROUP_RATE_MIN_ROOMS,
  GROUP_RATE_ROOMS,
  GUESTS_BOOK_BY_DAYS,
  LATE_BOOKING_DAYS,
  SECURED_STATUSES,
  SHUTTLE_MINUTES,
} from "./catalog";
import type { Lodging } from "./schema";

/*
 * Hébergement des invités : tout est calculé ici (besoins, calendrier,
 * couverture), à partir des invités marqués « vient de loin » et des
 * hébergements saisis par les mariés.
 */

type LodgingGuest = Pick<Guest, "status" | "is_child" | "family_id"> & { needs_lodging: boolean };

/**
 * Personnes à loger et chambres à prévoir : un foyer partage ses chambres
 * (deux adultes par chambre, les enfants avec leurs parents), un invité sans
 * foyer a la sienne. Les invités qui ont décliné ne comptent pas.
 */
export function lodgingNeeds(guests: readonly LodgingGuest[]): { people: number; rooms: number } {
  const hosted = guests.filter((guest) => guest.needs_lodging && guest.status !== "declined");
  const households = new Map<string, number>();
  let rooms = 0;
  for (const guest of hosted) {
    const adults = guest.is_child ? 0 : 1;
    if (guest.family_id === null) rooms += 1;
    else households.set(guest.family_id, (households.get(guest.family_id) ?? 0) + adults);
  }
  for (const adults of households.values()) rooms += Math.max(1, Math.ceil(adults / 2));
  return { people: hosted.length, rooms };
}

/** Où en est la réservation, selon le temps qui reste avant le mariage. */
export type BookingTimeline =
  | { phase: "noDate" }
  | { phase: "early"; blockBy: string; guestsBy: string; highSeason: boolean }
  | { phase: "now"; guestsBy: string; highSeason: boolean }
  | { phase: "late"; guestsBy: string | null; highSeason: boolean }
  | { phase: "past" };

/** Mai à septembre : la saison des mariages, où les hôtels se remplissent vite. */
const isHighSeason = (isoDate: string) => {
  const month = Number.parseInt(isoDate.slice(5, 7), 10);
  return month >= 5 && month <= 9;
};

export function bookingTimeline(weddingDate: string | null, today: string): BookingTimeline {
  if (weddingDate === null) return { phase: "noDate" };
  const daysLeft = daysBetween(today, weddingDate);
  if (daysLeft <= 0) return { phase: "past" };
  const highSeason = isHighSeason(weddingDate);
  const guestsBy = addDaysToIsoDate(weddingDate, -GUESTS_BOOK_BY_DAYS);
  if (daysLeft > BLOCK_ROOMS_DAYS) {
    return { phase: "early", blockBy: addDaysToIsoDate(weddingDate, -BLOCK_ROOMS_DAYS), guestsBy, highSeason };
  }
  if (daysLeft > LATE_BOOKING_DAYS) return { phase: "now", guestsBy, highSeason };
  return { phase: "late", guestsBy: daysLeft > GUESTS_BOOK_BY_DAYS ? guestsBy : null, highSeason };
}

/** Poids des chambres à réserver face à un hôtel. */
export type GroupLeverage = "strong" | "possible" | "small";

export function groupLeverage(rooms: number): GroupLeverage {
  if (rooms >= GROUP_RATE_ROOMS) return "strong";
  if (rooms >= GROUP_RATE_MIN_ROOMS) return "possible";
  return "small";
}

/** Chambres tenues pour les invités (en option ou confirmées). */
export function securedRooms(lodgings: readonly Lodging[]): number {
  return lodgings
    .filter((lodging) => SECURED_STATUSES.includes(lodging.status))
    .reduce((sum, lodging) => sum + (lodging.rooms ?? 0), 0);
}

/** Constat sur un hébergement : « watch » demande d'agir, « hint » est un conseil. */
export type LodgingCheck =
  | { tone: "watch"; key: "optionExpired" }
  | { tone: "watch"; key: "deadlineSoon"; days: number }
  | { tone: "hint"; key: "askGroupRate" }
  | { tone: "hint"; key: "shareCode" }
  | { tone: "hint"; key: "shuttle"; minutes: number };

export function lodgingChecks(lodging: Lodging, today: string): LodgingCheck[] {
  if (lodging.status === "declined") return [];
  const checks: LodgingCheck[] = [];
  if (lodging.deadline !== null && lodging.status !== "confirmed") {
    const days = daysBetween(today, lodging.deadline);
    if (days < 0) checks.push({ tone: "watch", key: "optionExpired" });
    else if (days <= DEADLINE_SOON_DAYS) checks.push({ tone: "watch", key: "deadlineSoon", days });
  }
  if ((lodging.rooms ?? 0) >= GROUP_RATE_MIN_ROOMS && !lodging.group_rate && lodging.kind === "hotel") {
    checks.push({ tone: "hint", key: "askGroupRate" });
  }
  if (lodging.group_rate && lodging.booking_code === null && SECURED_STATUSES.includes(lodging.status)) {
    checks.push({ tone: "hint", key: "shareCode" });
  }
  if (lodging.travel_minutes !== null && lodging.travel_minutes > SHUTTLE_MINUTES) {
    checks.push({ tone: "hint", key: "shuttle", minutes: lodging.travel_minutes });
  }
  return checks;
}

const STATUS_ORDER = { confirmed: 0, option: 1, contacted: 2, idea: 3, declined: 4 } as const;

/** Ordre d'affichage : les chambres tenues d'abord, les pistes écartées à la fin. */
export function sortLodgings(lodgings: readonly Lodging[]): Lodging[] {
  return [...lodgings].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.position - b.position,
  );
}

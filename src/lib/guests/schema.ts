import { z } from "zod";

export const GUEST_STATUSES = ["invited", "confirmed", "tentative", "declined"] as const;
export type GuestStatus = (typeof GUEST_STATUSES)[number];

export function isGuestStatus(value: string): value is GuestStatus {
  return (GUEST_STATUSES as readonly string[]).includes(value);
}

/**
 * Étapes de la journée, dans l'ordre chronologique.
 * Alignées sur la contrainte guests_events_check (000022_guest_events.sql).
 */
export const GUEST_EVENTS = ["ceremony", "cocktail", "dinner", "dessert", "brunch"] as const;
export type GuestEvent = (typeof GUEST_EVENTS)[number];

/** Par défaut, un invité est convié à toute la journée, sans le lendemain. */
export const DEFAULT_GUEST_EVENTS: readonly GuestEvent[] = [
  "ceremony",
  "cocktail",
  "dinner",
  "dessert",
];

/** Seule étape qui donne une place au plan de table. */
export const SEATED_EVENT = "dinner" satisfies GuestEvent;

/** Remet les étapes dans l'ordre chronologique, sans doublon. */
export function sortGuestEvents(events: readonly GuestEvent[]): GuestEvent[] {
  return GUEST_EVENTS.filter((event) => events.includes(event));
}

/**
 * Résumé des étapes : la journée habituelle n'est pas détaillée,
 * seules les exceptions le sont.
 */
export type GuestEventsSummary =
  | { kind: "fullDay"; brunch: boolean }
  | { kind: "partial"; events: GuestEvent[] };

export function summarizeGuestEvents(events: readonly GuestEvent[]): GuestEventsSummary {
  if (DEFAULT_GUEST_EVENTS.every((event) => events.includes(event))) {
    return { kind: "fullDay", brunch: events.includes("brunch") };
  }
  return { kind: "partial", events: sortGuestEvents(events) };
}

/** Ligne de la table guests, telle que lue par la page Invités. */
export type Guest = {
  id: string;
  first_name: string;
  last_name: string | null;
  status: GuestStatus;
  dietary_requirements: string | null;
  is_child: boolean;
  family_id: string | null;
  /** Étapes auxquelles l'invité est convié (au moins une). */
  events: GuestEvent[];
  /** Jeton du lien personnel de réponse (/i/<jeton>). */
  rsvp_token: string;
};

/** Ligne de la table guest_families. */
export type GuestFamily = {
  id: string;
  name: string;
};

/** Limites alignées sur les contraintes CHECK de 000005_guests.sql et 000009_guest_families.sql. */
export const GUEST_LIMITS = {
  firstName: 100,
  lastName: 100,
  dietaryRequirements: 200,
  familyName: 100,
} as const;

// Champ facultatif : une saisie vide est stockée à null (la contrainte SQL refuse "").
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const guestEventsSchema = z
  .array(z.enum(GUEST_EVENTS))
  .min(1)
  .transform((events) => sortGuestEvents(events));

export const addGuestSchema = z.object({
  firstName: z.string().trim().min(1).max(GUEST_LIMITS.firstName),
  lastName: optionalText(GUEST_LIMITS.lastName),
  status: z.enum(GUEST_STATUSES),
  dietaryRequirements: optionalText(GUEST_LIMITS.dietaryRequirements),
  isChild: z.boolean(),
  familyId: z.uuid().nullable(),
  events: guestEventsSchema,
});
export type AddGuestInput = z.input<typeof addGuestSchema>;
export type GuestField = keyof AddGuestInput;
export type GuestFieldError = "required" | "tooLong";

export const updateGuestStatusSchema = z.object({
  guestId: z.uuid(),
  status: z.enum(GUEST_STATUSES),
});

export const updateGuestEventsSchema = z.object({
  guestId: z.uuid(),
  events: guestEventsSchema,
});

export const deleteGuestSchema = z.object({
  guestId: z.uuid(),
});

export const familyNameSchema = z.object({
  name: z.string().trim().min(1).max(GUEST_LIMITS.familyName),
});
export type FamilyNameError = "required" | "tooLong";

export const renameFamilySchema = familyNameSchema.extend({
  familyId: z.uuid(),
});

export const deleteFamilySchema = z.object({
  familyId: z.uuid(),
});

export const assignFamilySchema = z.object({
  guestId: z.uuid(),
  familyId: z.uuid().nullable(),
});

export type GuestActionError = "unauthenticated" | "forbidden" | "generic";

export type AddGuestResult =
  | { ok: true }
  | {
      ok: false;
      error: GuestActionError | "invalid";
      fieldErrors?: Partial<Record<GuestField, GuestFieldError>>;
    };

export type GuestActionResult = { ok: true } | { ok: false; error: GuestActionError };

type FamilyNameFailure = {
  ok: false;
  error: GuestActionError | "invalid";
  fieldError?: FamilyNameError;
};

export type CreateFamilyResult = { ok: true; familyId: string } | FamilyNameFailure;
export type RenameFamilyResult = { ok: true } | FamilyNameFailure;

export type GuestSummary = {
  total: number;
  confirmed: number;
  /** Réponse attendue : invités sans réponse et réponses incertaines. */
  pending: number;
  /** Enfants n'ayant pas décliné. */
  children: number;
};

export function summarizeGuests(guests: readonly Guest[]): GuestSummary {
  const summary: GuestSummary = { total: 0, confirmed: 0, pending: 0, children: 0 };
  for (const guest of guests) {
    summary.total += 1;
    if (guest.status === "confirmed") summary.confirmed += 1;
    if (guest.status === "invited" || guest.status === "tentative") summary.pending += 1;
    if (guest.is_child && guest.status !== "declined") summary.children += 1;
  }
  return summary;
}

export type FamilySummary = {
  adults: number;
  children: number;
  confirmed: number;
  /** Réponse attendue : invités sans réponse et réponses incertaines. */
  pending: number;
  declined: number;
};

/** Composition d'une famille : tous ses membres, quelle que soit leur réponse. */
export function summarizeFamily(members: readonly Guest[]): FamilySummary {
  const summary: FamilySummary = { adults: 0, children: 0, confirmed: 0, pending: 0, declined: 0 };
  for (const guest of members) {
    if (guest.is_child) summary.children += 1;
    else summary.adults += 1;
    if (guest.status === "confirmed") summary.confirmed += 1;
    else if (guest.status === "declined") summary.declined += 1;
    else summary.pending += 1;
  }
  return summary;
}

/** Pour une étape : invités attendus (hors déclinés) et, parmi eux, confirmés. */
export type EventHeadcount = { expected: number; confirmed: number };

/** Comptes par étape, pour le traiteur et les lieux successifs. */
export function summarizeEvents(guests: readonly Guest[]): Record<GuestEvent, EventHeadcount> {
  const counts = Object.fromEntries(
    GUEST_EVENTS.map((event) => [event, { expected: 0, confirmed: 0 }]),
  ) as Record<GuestEvent, EventHeadcount>;
  for (const guest of guests) {
    if (guest.status === "declined") continue;
    for (const event of guest.events) {
      counts[event].expected += 1;
      if (guest.status === "confirmed") counts[event].confirmed += 1;
    }
  }
  return counts;
}

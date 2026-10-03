import { z } from "zod";

/** Ligne de la table itinerary_events, telle que lue par le conducteur. */
export type ItineraryEvent = {
  id: string;
  /** Heure normalisée « HH:MM » (PostgreSQL renvoie « HH:MM:SS »). */
  start_time: string;
  title: string;
  location: string | null;
  description: string | null;
  created_at: string;
};

/** Limites alignées sur les contraintes CHECK de 000007_itinerary_events.sql. */
export const ITINERARY_LIMITS = {
  title: 100,
  location: 100,
  description: 300,
} as const;

/** Heure sur 24 h, zéros compris : « 09:05 », « 23:59 ». */
export const START_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** « 14:30:00 » → « 14:30 ». */
export function toTimeKey(time: string): string {
  return time.slice(0, 5);
}

/**
 * Ordre chronologique du conducteur, identique à la requête SQL
 * (start_time, puis created_at). Les heures « HH:MM » se comparent comme des chaînes.
 */
export function compareEvents(a: ItineraryEvent, b: ItineraryEvent): number {
  if (a.start_time !== b.start_time) return a.start_time < b.start_time ? -1 : 1;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  return 0;
}

export function sortEvents(events: readonly ItineraryEvent[]): ItineraryEvent[] {
  return [...events].sort(compareEvents);
}

// Champ facultatif : une saisie vide est stockée à null (la contrainte SQL refuse "").
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

export const eventSchema = z.object({
  startTime: z.string().regex(START_TIME_PATTERN),
  title: z.string().trim().min(1).max(ITINERARY_LIMITS.title),
  location: optionalText(ITINERARY_LIMITS.location),
  description: optionalText(ITINERARY_LIMITS.description),
});
export type EventInput = z.input<typeof eventSchema>;
export type EventData = z.output<typeof eventSchema>;
export type EventField = keyof EventInput;
export type EventFieldError = "required" | "tooLong" | "time";
export type EventFieldErrors = Partial<Record<EventField, EventFieldError>>;

/** Traduit les erreurs Zod en clés d'erreur par champ (partagé client/serveur). */
export function parseEvent(
  input: EventInput,
): { ok: true; data: EventData } | { ok: false; fieldErrors: EventFieldErrors } {
  const parsed = eventSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: EventFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as EventField;
    fieldErrors[field] ??=
      field === "startTime" ? "time" : issue.code === "too_big" ? "tooLong" : "required";
  }
  return { ok: false, fieldErrors };
}

export const eventIdSchema = z.uuid();

export type ItineraryActionError = "unauthenticated" | "forbidden" | "invalid" | "generic";

export type ItineraryActionResult = { ok: true } | { ok: false; error: ItineraryActionError };

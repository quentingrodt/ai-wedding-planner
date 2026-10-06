import { z } from "zod";

/** Types de rendez-vous, traduits via Calendar.kinds.<kind>. */
export const CALENDAR_EVENT_KINDS = [
  "appointment",
  "visit",
  "tasting",
  "fitting",
  "deadline",
  "other",
] as const;
export type CalendarEventKind = (typeof CALENDAR_EVENT_KINDS)[number];

/** Ligne de la table calendar_events. */
export type CalendarEvent = {
  id: string;
  kind: CalendarEventKind;
  title: string;
  event_date: string;
  /** Heure « HH:MM » (normalisée), ou null pour la journée. */
  start_time: string | null;
  location: string | null;
  notes: string | null;
};

/** Limites alignées sur les contraintes CHECK de 000021_calendar_events.sql. */
export const CALENDAR_LIMITS = { title: 120, location: 120, notes: 500 } as const;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// Champ facultatif : une saisie vide est stockée à null (la contrainte SQL refuse "").
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

export const calendarEventSchema = z.object({
  kind: z.enum(CALENDAR_EVENT_KINDS),
  title: z.string().trim().min(1).max(CALENDAR_LIMITS.title),
  date: z.iso.date(),
  time: z
    .string()
    .trim()
    .refine((value) => value === "" || TIME_PATTERN.test(value))
    .transform((value) => (value === "" ? null : value)),
  location: optionalText(CALENDAR_LIMITS.location),
  notes: optionalText(CALENDAR_LIMITS.notes),
});
export type CalendarEventInput = z.input<typeof calendarEventSchema>;
export type CalendarEventData = z.output<typeof calendarEventSchema>;
export type CalendarEventField = keyof CalendarEventInput;
export type CalendarFieldError = "required" | "tooLong" | "invalid";
export type CalendarFieldErrors = Partial<Record<CalendarEventField, CalendarFieldError>>;

/** Traduit les erreurs Zod en clés d'erreur par champ (partagé client/serveur). */
export function parseCalendarEvent(
  input: CalendarEventInput,
):
  | { ok: true; data: CalendarEventData }
  | { ok: false; fieldErrors: CalendarFieldErrors } {
  const parsed = calendarEventSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: CalendarFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as CalendarEventField;
    fieldErrors[field] ??=
      issue.code === "too_big"
        ? "tooLong"
        : field === "title"
          ? "required"
          : "invalid";
  }
  return { ok: false, fieldErrors };
}

export type CalendarActionResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "unauthenticated" | "forbidden" | "generic" };

import { z } from "zod";
import {
  RATING_COLUMNS,
  RATING_MAX,
  VENUE_CATERINGS,
  VENUE_CRITERIA,
  VENUE_DATE_STATUSES,
  VENUE_STATUSES,
  VENUE_STYLES,
  type VenueCatering,
  type VenueCriterion,
  type VenueDateStatus,
  type VenueStatus,
  type VenueStyle,
} from "./catalog";

/** Limites alignées sur les contraintes CHECK de 000027_venues.sql. */
export const VENUE_LIMITS = {
  name: 120,
  url: 1000,
  location: 160,
  travelMinutes: 1440,
  capacity: 5000,
  price: 10_000_000,
  beds: 2000,
  accommodationNote: 300,
  restrictions: 400,
  datesNote: 300,
  notes: 1000,
  noteItem: 140,
  noteItems: 12,
} as const;

/** Ligne de la table venues ; montants en unités entières de la devise du mariage. */
export type Venue = {
  id: string;
  name: string;
  status: VenueStatus;
  url: string | null;
  /** Date ISO (YYYY-MM-DD). */
  visit_date: string | null;
  location: string | null;
  travel_minutes: number | null;
  capacity: number | null;
  price: number | null;
  style: VenueStyle | null;
  beds: number | null;
  accommodation_note: string | null;
  catering: VenueCatering | null;
  /** Heure PostgreSQL (HH:MM:SS). */
  curfew: string | null;
  restrictions: string | null;
  date_status: VenueDateStatus | null;
  dates_note: string | null;
  rating_location: number | null;
  rating_capacity: number | null;
  rating_budget: number | null;
  rating_style: number | null;
  rating_accommodation: number | null;
  rating_service: number | null;
  rating_restrictions: number | null;
  rating_flexibility: number | null;
  pros: string[];
  cons: string[];
  notes: string | null;
  position: number;
};

export const VENUE_COLUMNS =
  "id, name, status, url, visit_date, location, travel_minutes, capacity, price, style, beds, " +
  "accommodation_note, catering, curfew, restrictions, date_status, dates_note, " +
  "rating_location, rating_capacity, rating_budget, rating_style, rating_accommodation, " +
  "rating_service, rating_restrictions, rating_flexibility, pros, cons, notes, position";

/** Note d'un critère, ou null s'il n'est pas encore noté. */
export const ratingOf = (venue: Venue, criterion: VenueCriterion) => venue[RATING_COLUMNS[criterion]];

// Champ facultatif : une saisie vide est stockée à null (la contrainte SQL refuse "").
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const optionalNumber = (max: number, min = 0) => z.number().int().min(min).max(max).nullable();

const noteList = z
  .array(z.string().trim().max(VENUE_LIMITS.noteItem))
  .transform((items) => items.filter((item) => item !== ""))
  .pipe(z.array(z.string()).max(VENUE_LIMITS.noteItems));

/**
 * Statuts choisis depuis la fiche : « réservé » passe par chooseVenue, qui
 * garantit un seul lieu retenu (index unique venues_one_booked_idx).
 */
export const EDITABLE_STATUSES = VENUE_STATUSES.filter(
  (status): status is Exclude<VenueStatus, "booked"> => status !== "booked",
);

export const venueInputSchema = z.object({
  name: z.string().trim().min(1).max(VENUE_LIMITS.name),
  /** Absent : le statut actuel est conservé (lieu déjà retenu). */
  status: z.enum(EDITABLE_STATUSES).optional(),
  url: z
    .string()
    .trim()
    .max(VENUE_LIMITS.url)
    .refine((value) => value === "" || (/^https?:\/\//.test(value) && URL.canParse(value)))
    .transform((value) => (value === "" ? null : value)),
  visitDate: z
    .union([z.literal(""), z.iso.date()])
    .transform((value) => (value === "" ? null : value)),
  location: optionalText(VENUE_LIMITS.location),
  travelMinutes: optionalNumber(VENUE_LIMITS.travelMinutes),
  capacity: optionalNumber(VENUE_LIMITS.capacity, 1),
  price: optionalNumber(VENUE_LIMITS.price),
  style: z.enum(VENUE_STYLES).nullable(),
  beds: optionalNumber(VENUE_LIMITS.beds),
  accommodationNote: optionalText(VENUE_LIMITS.accommodationNote),
  catering: z.enum(VENUE_CATERINGS).nullable(),
  curfew: z
    .union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)])
    .transform((value) => (value === "" ? null : value)),
  restrictions: optionalText(VENUE_LIMITS.restrictions),
  dateStatus: z.enum(VENUE_DATE_STATUSES).nullable(),
  datesNote: optionalText(VENUE_LIMITS.datesNote),
  ratings: z.partialRecord(z.enum(VENUE_CRITERIA), z.number().int().min(1).max(RATING_MAX).nullable()),
  pros: noteList,
  cons: noteList,
  notes: optionalText(VENUE_LIMITS.notes),
});
export type VenueInput = z.input<typeof venueInputSchema>;

/** Colonnes de la table venues à partir d'une saisie validée. */
export function toVenueRow(input: z.output<typeof venueInputSchema>) {
  const ratings = Object.fromEntries(
    VENUE_CRITERIA.map((criterion) => [RATING_COLUMNS[criterion], input.ratings[criterion] ?? null]),
  );
  return {
    name: input.name,
    ...(input.status && { status: input.status }),
    url: input.url,
    visit_date: input.visitDate,
    location: input.location,
    travel_minutes: input.travelMinutes,
    capacity: input.capacity,
    price: input.price,
    style: input.style,
    beds: input.beds,
    accommodation_note: input.accommodationNote,
    catering: input.catering,
    curfew: input.curfew,
    restrictions: input.restrictions,
    date_status: input.dateStatus,
    dates_note: input.datesNote,
    ...ratings,
    pros: input.pros,
    cons: input.cons,
    notes: input.notes,
  };
}

export const idSchema = z.uuid();
export const editableStatusSchema = z.enum(EDITABLE_STATUSES);

export type VenueActionError = "unauthenticated" | "forbidden" | "invalid" | "generic";
export type VenueActionResult = { ok: true } | { ok: false; error: VenueActionError };

import { z } from "zod";
import { LODGING_KINDS, LODGING_STATUSES, type LodgingKind, type LodgingStatus } from "./catalog";

/** Limites alignées sur les contraintes CHECK de 000028_guest_lodging.sql. */
export const LODGING_LIMITS = {
  name: 120,
  location: 160,
  travelMinutes: 1440,
  rooms: 500,
  pricePerNight: 100_000,
  bookingCode: 80,
  url: 1000,
  contact: 160,
  notes: 600,
} as const;

/** Ligne de la table guest_lodgings ; montants en unités entières de la devise du mariage. */
export type Lodging = {
  id: string;
  name: string;
  kind: LodgingKind;
  status: LodgingStatus;
  location: string | null;
  travel_minutes: number | null;
  rooms: number | null;
  price_per_night: number | null;
  group_rate: boolean;
  booking_code: string | null;
  /** Date ISO (YYYY-MM-DD). */
  deadline: string | null;
  url: string | null;
  contact: string | null;
  notes: string | null;
  position: number;
};

export const LODGING_COLUMNS =
  "id, name, kind, status, location, travel_minutes, rooms, price_per_night, group_rate, " +
  "booking_code, deadline, url, contact, notes, position";

// Champ facultatif : une saisie vide est stockée à null (la contrainte SQL refuse "").
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const optionalNumber = (max: number, min = 0) => z.number().int().min(min).max(max).nullable();

export const lodgingInputSchema = z.object({
  name: z.string().trim().min(1).max(LODGING_LIMITS.name),
  kind: z.enum(LODGING_KINDS),
  status: z.enum(LODGING_STATUSES),
  location: optionalText(LODGING_LIMITS.location),
  travelMinutes: optionalNumber(LODGING_LIMITS.travelMinutes),
  rooms: optionalNumber(LODGING_LIMITS.rooms, 1),
  pricePerNight: optionalNumber(LODGING_LIMITS.pricePerNight),
  groupRate: z.boolean(),
  bookingCode: optionalText(LODGING_LIMITS.bookingCode),
  deadline: z.union([z.literal(""), z.iso.date()]).transform((value) => (value === "" ? null : value)),
  url: z
    .string()
    .trim()
    .max(LODGING_LIMITS.url)
    .refine((value) => value === "" || (/^https?:\/\//.test(value) && URL.canParse(value)))
    .transform((value) => (value === "" ? null : value)),
  contact: optionalText(LODGING_LIMITS.contact),
  notes: optionalText(LODGING_LIMITS.notes),
});
export type LodgingInput = z.input<typeof lodgingInputSchema>;

/** Colonnes de guest_lodgings à partir d'une saisie validée. */
export function toLodgingRow(input: z.output<typeof lodgingInputSchema>) {
  return {
    name: input.name,
    kind: input.kind,
    status: input.status,
    location: input.location,
    travel_minutes: input.travelMinutes,
    rooms: input.rooms,
    price_per_night: input.pricePerNight,
    group_rate: input.groupRate,
    booking_code: input.bookingCode,
    deadline: input.deadline,
    url: input.url,
    contact: input.contact,
    notes: input.notes,
  };
}

/** Invité tel que lu par la page Hébergement. */
export type LodgingGuest = {
  id: string;
  first_name: string;
  last_name: string | null;
  status: "invited" | "confirmed" | "tentative" | "declined";
  is_child: boolean;
  family_id: string | null;
  needs_lodging: boolean;
};

export const idSchema = z.uuid();
export const lodgingStatusSchema = z.enum(LODGING_STATUSES);

/** Invités d'un même foyer (ou un invité seul) marqués « vient de loin » d'un coup. */
export const setNeedsLodgingSchema = z.object({
  guestIds: z.array(z.uuid()).min(1).max(50),
  needsLodging: z.boolean(),
});

export type LodgingActionError = "unauthenticated" | "forbidden" | "invalid" | "generic";
export type LodgingActionResult = { ok: true } | { ok: false; error: LodgingActionError };

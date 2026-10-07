import { z } from "zod";
import { GUEST_EVENTS, GUEST_LIMITS, GUEST_STATUSES, sortGuestEvents } from "@/lib/guests/schema";
import { invitationDesignSchema } from "@/lib/invitations/schema";
import { LODGING_KINDS, LODGING_STATUSES } from "@/lib/lodging/catalog";

/** Réponses qu'un invité peut donner lui-même (pas « invité »). */
export const RSVP_STATUSES = ["confirmed", "tentative", "declined"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

/** Hébergement partagé avec un invité venant de loin (cf. 000029) : jamais les notes des mariés. */
export const guestLodgingSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(LODGING_KINDS),
  location: z.string().nullable(),
  travel_minutes: z.number().int().nullable(),
  price_per_night: z.number().int().nullable(),
  group_rate: z.boolean(),
  booking_code: z.string().nullable(),
  deadline: z.iso.date().nullable(),
  url: z.string().nullable(),
  contact: z.string().nullable(),
});
export type GuestLodging = z.infer<typeof guestLodgingSchema>;

/** Hébergement attribué à l'invité (cf. 000030), avec ceux qui partagent la maison. */
export const myLodgingSchema = guestLodgingSchema.extend({
  status: z.enum(LODGING_STATUSES),
  housemates: z.array(z.string()).catch([]),
});
export type MyLodging = z.infer<typeof myLodgingSchema>;

/** Résultat de la RPC get_guest_rsvp (cf. 000015 et 000023), revalidé avant affichage. */
export const guestRsvpSchema = z.object({
  first_name: z.string(),
  last_name: z.string().nullable(),
  status: z.enum(GUEST_STATUSES),
  dietary_requirements: z.string().nullable(),
  // Étapes conviées (cf. 000023) ; absentes ou illisibles, la page ne les affiche pas.
  events: z
    .array(z.enum(GUEST_EVENTS))
    .min(1)
    .transform((events) => sortGuestEvents(events))
    .nullable()
    .catch(null),
  wedding_title: z.string(),
  wedding_date: z.iso.date().nullable(),
  // Faire-part absent ou illisible : la page affiche un en-tête simple.
  design: invitationDesignSchema.nullable().catch(null),
  // Liste de mariage ouverte par les mariés (cf. 000026).
  has_registry: z.boolean().catch(false),
  // Hébergements conseillés, pour un invité venant de loin (cf. 000029).
  lodgings: z.array(guestLodgingSchema).catch([]),
  my_lodging: myLodgingSchema.nullable().catch(null),
  currency: z.string().length(3).catch("EUR"),
});
export type GuestRsvp = z.infer<typeof guestRsvpSchema>;

export const rsvpTokenSchema = z.uuid();

export const submitRsvpSchema = z.object({
  token: rsvpTokenSchema,
  status: z.enum(RSVP_STATUSES),
  dietary: z.string().trim().max(GUEST_LIMITS.dietaryRequirements),
});
export type SubmitRsvpInput = z.input<typeof submitRsvpSchema>;

export type SubmitRsvpResult =
  | { ok: true; status: RsvpStatus }
  | { ok: false; error: "invalid" | "closed" | "generic" };

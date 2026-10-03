import { z } from "zod";

export const GUEST_STATUSES = ["invited", "confirmed", "tentative", "declined"] as const;
export type GuestStatus = (typeof GUEST_STATUSES)[number];

export function isGuestStatus(value: string): value is GuestStatus {
  return (GUEST_STATUSES as readonly string[]).includes(value);
}

/** Ligne de la table guests, telle que lue par la page Invités. */
export type Guest = {
  id: string;
  first_name: string;
  last_name: string | null;
  status: GuestStatus;
  dietary_requirements: string | null;
  is_child: boolean;
};

/** Limites alignées sur les contraintes CHECK de 000005_guests.sql. */
export const GUEST_LIMITS = {
  firstName: 100,
  lastName: 100,
  dietaryRequirements: 200,
} as const;

// Champ facultatif : une saisie vide est stockée à null (la contrainte SQL refuse "").
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

export const addGuestSchema = z.object({
  firstName: z.string().trim().min(1).max(GUEST_LIMITS.firstName),
  lastName: optionalText(GUEST_LIMITS.lastName),
  status: z.enum(GUEST_STATUSES),
  dietaryRequirements: optionalText(GUEST_LIMITS.dietaryRequirements),
  isChild: z.boolean(),
});
export type AddGuestInput = z.input<typeof addGuestSchema>;
export type GuestField = keyof AddGuestInput;
export type GuestFieldError = "required" | "tooLong";

export const updateGuestStatusSchema = z.object({
  guestId: z.uuid(),
  status: z.enum(GUEST_STATUSES),
});

export const deleteGuestSchema = z.object({
  guestId: z.uuid(),
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

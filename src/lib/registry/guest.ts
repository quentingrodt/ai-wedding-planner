import { z } from "zod";
import { FUND_KINDS, REGISTRY_SECTIONS } from "./catalog";
import { REGISTRY_LIMITS } from "./schema";

/**
 * Liste de mariage vue par un invité (RPC get_guest_registry, cf. 000026),
 * revalidée avant affichage. Les réservations des autres n'y figurent qu'en
 * totaux : jamais qui a offert quoi.
 */

const amount = z.number().int().nonnegative();

export const guestRegistrySchema = z.object({
  first_name: z.string(),
  wedding_title: z.string(),
  currency: z.string().length(3),
  note: z.string().nullable(),
  accepts_suggestions: z.boolean(),
  payment_link: z.string().nullable(),
  payment_details: z.string().nullable(),
  gifts: z.array(
    z.object({
      id: z.uuid(),
      section: z.enum(REGISTRY_SECTIONS),
      title: z.string(),
      description: z.string().nullable(),
      price: amount.nullable(),
      quantity: z.number().int().positive(),
      url: z.string().nullable(),
      image_url: z.string().nullable(),
      is_heirloom: z.boolean(),
      reserved: amount,
      participants: amount,
      mine: z.boolean(),
      mine_quantity: z.number().int().positive().nullable(),
      mine_amount: amount.nullable(),
    }),
  ),
  funds: z.array(
    z.object({
      id: z.uuid(),
      kind: z.enum(FUND_KINDS),
      title: z.string(),
      description: z.string().nullable(),
      goal: amount.nullable(),
      raised: amount,
      mine_amount: amount.nullable(),
    }),
  ),
});
export type GuestRegistry = z.infer<typeof guestRegistrySchema>;
export type GuestRegistryGift = GuestRegistry["gifts"][number];
export type GuestRegistryFund = GuestRegistry["funds"][number];

/** Exemplaires encore libres pour cet invité (ses propres réservations comptent comme libres). */
export function availableFor(gift: GuestRegistryGift): number {
  const others = gift.reserved - (gift.mine_quantity ?? 0);
  return Math.max(0, gift.quantity - others);
}

/** Avancement d'un projet de l'urne, entre 0 et 1 ; null sans objectif. */
export function fundProgress(fund: Pick<GuestRegistryFund, "goal" | "raised">): number | null {
  if (!fund.goal) return null;
  return Math.min(1, fund.raised / fund.goal);
}

const token = z.uuid();
const message = z
  .string()
  .trim()
  .max(300)
  .transform((value) => (value === "" ? null : value));
const optionalAmount = z.number().int().min(1).max(REGISTRY_LIMITS.price).nullable();

export const reserveGiftSchema = z.object({
  token,
  giftId: z.uuid(),
  quantity: z.number().int().min(1).max(REGISTRY_LIMITS.quantity).nullable(),
  amount: optionalAmount,
  message,
});
export type ReserveGiftInput = z.input<typeof reserveGiftSchema>;

export const pledgeFundSchema = z.object({
  token,
  fundId: z.uuid(),
  amount: z.number().int().min(1).max(REGISTRY_LIMITS.price),
  message,
});
export type PledgeFundInput = z.input<typeof pledgeFundSchema>;

export const withdrawSchema = z.object({ token, targetId: z.uuid() });

export const suggestIdeaSchema = z.object({
  token,
  idea: z.string().trim().min(1).max(300),
});

export type GuestRegistryError = "invalid" | "unavailable" | "closed" | "limit" | "generic";
export type GuestRegistryResult = { ok: true } | { ok: false; error: GuestRegistryError };

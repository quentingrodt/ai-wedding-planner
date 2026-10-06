import { z } from "zod";
import { FUND_KINDS, MAX_FUNDS, REGISTRY_SECTIONS, type FundKind, type RegistrySection } from "./catalog";

/** Limites alignées sur les contraintes CHECK de 000025_registry.sql. */
export const REGISTRY_LIMITS = {
  note: 600,
  paymentLink: 500,
  paymentDetails: 300,
  giftTitle: 120,
  giftDescription: 300,
  price: 1_000_000,
  quantity: 50,
  url: 1000,
  fundTitle: 100,
  fundDescription: 400,
} as const;

/** Réglages de la liste (table registries). */
export type Registry = {
  note: string | null;
  accepts_suggestions: boolean;
  payment_link: string | null;
  payment_details: string | null;
};

/** Ligne de registry_gifts. */
export type RegistryGift = {
  id: string;
  section: RegistrySection;
  title: string;
  description: string | null;
  /** Unités entières de la devise du mariage. */
  price: number | null;
  quantity: number;
  url: string | null;
  image_url: string | null;
  is_heirloom: boolean;
  position: number;
};

/** Ligne de registry_funds. */
export type RegistryFund = {
  id: string;
  kind: FundKind;
  title: string;
  description: string | null;
  goal: number | null;
  position: number;
};

// Champ facultatif : une saisie vide est stockée à null (la contrainte SQL refuse "").
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const optionalUrl = (protocol: RegExp, max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => value === "" || (protocol.test(value) && URL.canParse(value)))
    .transform((value) => (value === "" ? null : value));

const optionalAmount = (max: number, min = 0) =>
  z.number().int().min(min).max(max).nullable();

export const giftInputSchema = z.object({
  section: z.enum(REGISTRY_SECTIONS),
  title: z.string().trim().min(1).max(REGISTRY_LIMITS.giftTitle),
  description: optionalText(REGISTRY_LIMITS.giftDescription),
  price: optionalAmount(REGISTRY_LIMITS.price),
  quantity: z.number().int().min(1).max(REGISTRY_LIMITS.quantity),
  url: optionalUrl(/^https?:\/\//, REGISTRY_LIMITS.url),
  imageUrl: optionalUrl(/^https:\/\//, REGISTRY_LIMITS.url),
  isHeirloom: z.boolean(),
});
export type GiftInput = z.input<typeof giftInputSchema>;
export type GiftField = keyof GiftInput;

export const fundInputSchema = z.object({
  kind: z.enum(FUND_KINDS),
  title: z.string().trim().min(1).max(REGISTRY_LIMITS.fundTitle),
  description: optionalText(REGISTRY_LIMITS.fundDescription),
  goal: optionalAmount(REGISTRY_LIMITS.price, 1),
});
export type FundInput = z.input<typeof fundInputSchema>;

export const registrySettingsSchema = z.object({
  note: optionalText(REGISTRY_LIMITS.note),
  acceptsSuggestions: z.boolean(),
  paymentLink: optionalUrl(/^https:\/\//, REGISTRY_LIMITS.paymentLink),
  paymentDetails: optionalText(REGISTRY_LIMITS.paymentDetails),
});
export type RegistrySettingsInput = z.input<typeof registrySettingsSchema>;

/** Résultat du parcours d'ouverture : la liste entière, créée d'un coup. */
export const setUpRegistrySchema = registrySettingsSchema.extend({
  gifts: z
    .array(
      z.object({
        section: z.enum(REGISTRY_SECTIONS),
        title: z.string().trim().min(1).max(REGISTRY_LIMITS.giftTitle),
        isHeirloom: z.boolean(),
      }),
    )
    .max(120),
  funds: z.array(fundInputSchema).max(MAX_FUNDS),
});
export type SetUpRegistryInput = z.input<typeof setUpRegistrySchema>;

export const idSchema = z.uuid();

export type RegistryActionError = "unauthenticated" | "forbidden" | "invalid" | "generic";
export type RegistryActionResult = { ok: true } | { ok: false; error: RegistryActionError };

/** Valeur totale de la liste (prix × quantité), calculée ici et non par l'IA. */
export function registryTotal(gifts: readonly Pick<RegistryGift, "price" | "quantity">[]): number {
  return gifts.reduce((sum, gift) => sum + (gift.price ?? 0) * gift.quantity, 0);
}

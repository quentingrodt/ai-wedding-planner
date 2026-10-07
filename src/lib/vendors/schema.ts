import { z } from "zod";
import {
  PRICE_BASES,
  VENDOR_CATEGORIES,
  VENDOR_STATUSES,
  type PriceBasis,
  type VendorCategory,
  type VendorStatus,
} from "./catalog";
import type { VendorDetails } from "./details";

/** Limites alignées sur les contraintes CHECK de 000031_vendors.sql. */
export const VENDOR_LIMITS = {
  name: 120,
  contactName: 120,
  phone: 40,
  email: 254,
  url: 1000,
  location: 160,
  price: 10_000_000,
  notes: 1000,
  noteItem: 140,
  noteItems: 12,
} as const;

/** Ligne de la table vendors ; montants en unités entières de la devise du mariage. */
export type Vendor = {
  id: string;
  category: VendorCategory;
  name: string;
  status: VendorStatus;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  url: string | null;
  location: string | null;
  price: number | null;
  price_basis: PriceBasis;
  /** Échéancier : acompte, deuxième versement, solde (prix convenu moins les versements). */
  deposit: number | null;
  deposit_due: string | null;
  deposit_paid: boolean;
  second_payment: number | null;
  second_due: string | null;
  second_paid: boolean;
  balance_due: string | null;
  balance_paid: boolean;
  /** Date ISO (YYYY-MM-DD). */
  meeting_date: string | null;
  rating: number | null;
  /** Détails de la catégorie et questions posées, lus avec readDetails. */
  details: VendorDetails;
  pros: string[];
  cons: string[];
  notes: string | null;
  position: number;
};

export const VENDOR_COLUMNS =
  "id, category, name, status, contact_name, phone, email, url, location, price, price_basis, " +
  "deposit, deposit_due, deposit_paid, second_payment, second_due, second_paid, balance_due, balance_paid, " +
  "meeting_date, rating, details, pros, cons, notes, position";

// Champ facultatif : une saisie vide est stockée à null (la contrainte SQL refuse "").
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const optionalAmount = z.number().int().min(0).max(VENDOR_LIMITS.price).nullable();

const optionalDate = z.union([z.literal(""), z.iso.date()]).transform((value) => (value === "" ? null : value));

const noteList = z
  .array(z.string().trim().max(VENDOR_LIMITS.noteItem))
  .transform((items) => items.filter((item) => item !== ""))
  .pipe(z.array(z.string()).max(VENDOR_LIMITS.noteItems));

export const vendorInputSchema = z.object({
  name: z.string().trim().min(1).max(VENDOR_LIMITS.name),
  status: z.enum(VENDOR_STATUSES),
  contactName: optionalText(VENDOR_LIMITS.contactName),
  phone: optionalText(VENDOR_LIMITS.phone),
  email: z
    .string()
    .trim()
    .max(VENDOR_LIMITS.email)
    .refine((value) => value === "" || z.email().safeParse(value).success)
    .transform((value) => (value === "" ? null : value)),
  url: z
    .string()
    .trim()
    .max(VENDOR_LIMITS.url)
    .refine((value) => value === "" || (/^https?:\/\//.test(value) && URL.canParse(value)))
    .transform((value) => (value === "" ? null : value)),
  location: optionalText(VENDOR_LIMITS.location),
  price: optionalAmount,
  priceBasis: z.enum(PRICE_BASES),
  deposit: optionalAmount,
  depositDue: optionalDate,
  depositPaid: z.boolean(),
  secondPayment: optionalAmount,
  secondDue: optionalDate,
  secondPaid: z.boolean(),
  balanceDue: optionalDate,
  balancePaid: z.boolean(),
  /** Validés selon la catégorie (detailsSchema) par l'action. */
  details: z.record(z.string(), z.unknown()),
  meetingDate: optionalDate,
  rating: z.number().int().min(1).max(5).nullable(),
  pros: noteList,
  cons: noteList,
  notes: optionalText(VENDOR_LIMITS.notes),
});
export type VendorInput = z.input<typeof vendorInputSchema>;

/** Colonnes de la table vendors à partir d'une saisie validée. */
export function toVendorRow(input: z.output<typeof vendorInputSchema>) {
  return {
    name: input.name,
    status: input.status,
    contact_name: input.contactName,
    phone: input.phone,
    email: input.email,
    url: input.url,
    location: input.location,
    price: input.price,
    price_basis: input.priceBasis,
    deposit: input.deposit,
    deposit_due: input.depositDue,
    deposit_paid: input.depositPaid,
    second_payment: input.secondPayment,
    second_due: input.secondDue,
    second_paid: input.secondPaid,
    balance_due: input.balanceDue,
    balance_paid: input.balancePaid,
    meeting_date: input.meetingDate,
    rating: input.rating,
    pros: input.pros,
    cons: input.cons,
    notes: input.notes,
  };
}

export const idSchema = z.uuid();
export const vendorCategorySchema = z.enum(VENDOR_CATEGORIES);
export const vendorStatusSchema = z.enum(VENDOR_STATUSES);

export type VendorActionError = "unauthenticated" | "forbidden" | "invalid" | "generic";
export type VendorActionResult = { ok: true } | { ok: false; error: VendorActionError };

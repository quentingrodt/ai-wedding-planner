import type { BudgetCategory, BudgetItem } from "@/lib/budget/schema";
import { daysBetween } from "@/lib/weddings/dates";
import { VENDOR_CATEGORIES, type VendorCategory } from "./catalog";
import type { Vendor } from "./schema";

/*
 * Prestataires : coûts, constats et état de chaque catégorie, calculés ici à
 * partir des pistes saisies par les mariés et des données du mariage.
 */

/** Un rendez-vous sous 14 jours se prépare (questions, échantillons). */
export const MEETING_SOON_DAYS = 14;

/** Coût total d'une piste : prix par invité × invités attendus, ou prix total. */
export function vendorTotal(vendor: Pick<Vendor, "price" | "price_basis">, guestCount: number | null): number | null {
  if (vendor.price === null) return null;
  if (vendor.price_basis === "total") return vendor.price;
  return guestCount === null ? null : vendor.price * guestCount;
}

/** Montant prévu au budget pour un poste (somme des lignes), ou null s'il n'est pas chiffré. */
export function budgetEnvelope(
  items: readonly Pick<BudgetItem, "category" | "estimated_amount">[],
  category: BudgetCategory,
): number | null {
  const planned = items
    .filter((item) => item.category === category)
    .reduce((sum, item) => sum + item.estimated_amount, 0);
  return planned > 0 ? planned : null;
}

export type VendorCheck =
  | { tone: "watch"; key: "overBudget"; over: number }
  | { tone: "watch"; key: "depositDue"; amount: number }
  | { tone: "hint"; key: "meetingSoon"; days: number }
  | { tone: "hint"; key: "askQuote" };

export function vendorChecks(
  vendor: Vendor,
  context: { guestCount: number | null; envelope: number | null; today: string },
): VendorCheck[] {
  if (vendor.status === "declined") return [];
  const checks: VendorCheck[] = [];
  const total = vendorTotal(vendor, context.guestCount);
  if (total !== null && context.envelope !== null && total > context.envelope) {
    checks.push({ tone: "watch", key: "overBudget", over: total - context.envelope });
  }
  if (vendor.status === "booked" && vendor.deposit !== null && vendor.deposit > 0 && !vendor.deposit_paid) {
    checks.push({ tone: "watch", key: "depositDue", amount: vendor.deposit });
  }
  if (vendor.meeting_date !== null) {
    const days = daysBetween(context.today, vendor.meeting_date);
    if (days >= 0 && days <= MEETING_SOON_DAYS) checks.push({ tone: "hint", key: "meetingSoon", days });
  }
  if (vendor.status === "contacted" && vendor.price === null) checks.push({ tone: "hint", key: "askQuote" });
  return checks;
}

const STATUS_ORDER = { booked: 0, meeting: 1, quote: 2, contacted: 3, idea: 4, declined: 5 } as const;

/** Ordre d'affichage : réservés, puis par avancement et note, les pistes écartées à la fin. */
export function sortVendors(vendors: readonly Vendor[]): Vendor[] {
  return [...vendors].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (b.rating ?? 0) - (a.rating ?? 0) ||
      a.position - b.position,
  );
}

/** Où en est une catégorie : les prestataires réservés et le nombre de pistes en cours. */
export type CategoryProgress = { booked: string[]; leads: number };

export function categoryProgress(vendors: readonly Vendor[]): Record<VendorCategory, CategoryProgress> {
  const progress = Object.fromEntries(
    VENDOR_CATEGORIES.map((category) => [category, { booked: [] as string[], leads: 0 }]),
  ) as Record<VendorCategory, CategoryProgress>;
  for (const vendor of vendors) {
    if (vendor.status === "booked") progress[vendor.category].booked.push(vendor.name);
    else if (vendor.status !== "declined") progress[vendor.category].leads += 1;
  }
  return progress;
}

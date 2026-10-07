import { daysBetween } from "@/lib/weddings/dates";
import type { Vendor } from "./schema";

/*
 * Échéancier d'un prestataire : acompte, deuxième versement, puis le solde,
 * qui n'est pas saisi mais calculé (prix convenu moins les versements).
 */

export const INSTALMENTS = ["deposit", "second", "balance"] as const;
export type InstalmentKind = (typeof INSTALMENTS)[number];

export type Instalment = { kind: InstalmentKind; amount: number; due: string | null; paid: boolean };

/** Coût total d'une piste : prix par invité × invités attendus, ou prix total. */
export function vendorTotal(vendor: Pick<Vendor, "price" | "price_basis">, guestCount: number | null): number | null {
  if (vendor.price === null) return null;
  if (vendor.price_basis === "total") return vendor.price;
  return guestCount === null ? null : vendor.price * guestCount;
}

/** Un versement à régler sous 14 jours mérite un rappel. */
export const PAYMENT_SOON_DAYS = 14;

/** Les versements prévus (montant non nul), dans l'ordre. */
export function instalments(vendor: Vendor, guestCount: number | null): Instalment[] {
  const total = vendorTotal(vendor, guestCount);
  const deposit = vendor.deposit ?? 0;
  const second = vendor.second_payment ?? 0;
  const list: Instalment[] = [
    { kind: "deposit", amount: deposit, due: vendor.deposit_due, paid: vendor.deposit_paid },
    { kind: "second", amount: second, due: vendor.second_due, paid: vendor.second_paid },
  ];
  if (total !== null) {
    list.push({
      kind: "balance",
      amount: Math.max(0, total - deposit - second),
      due: vendor.balance_due,
      paid: vendor.balance_paid,
    });
  }
  return list.filter((instalment) => instalment.amount > 0);
}

/** Réglé, reste à payer et prochain versement d'un prestataire. */
export function paymentSummary(vendor: Vendor, guestCount: number | null) {
  const list = instalments(vendor, guestCount);
  const paid = list.filter((instalment) => instalment.paid).reduce((sum, instalment) => sum + instalment.amount, 0);
  const remaining = list.filter((instalment) => !instalment.paid).reduce((sum, instalment) => sum + instalment.amount, 0);
  const next =
    list
      .filter((instalment) => !instalment.paid)
      .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"))[0] ?? null;
  return { instalments: list, paid, remaining, next };
}

/** Versement à venir ou en retard, avec son prestataire, pour l'échéancier global. */
export type UpcomingPayment = Instalment & { vendor: Vendor; days: number | null };

/**
 * Versements non réglés des prestataires réservés : en retard d'abord, puis
 * par date ; ceux sans date ferment la liste.
 */
export function upcomingPayments(
  vendors: readonly Vendor[],
  guestCount: number | null,
  today: string,
): UpcomingPayment[] {
  return vendors
    .filter((vendor) => vendor.status === "booked")
    .flatMap((vendor) =>
      instalments(vendor, guestCount)
        .filter((instalment) => !instalment.paid)
        .map((instalment) => ({
          ...instalment,
          vendor,
          days: instalment.due ? daysBetween(today, instalment.due) : null,
        })),
    )
    .sort((a, b) => (a.days ?? Number.MAX_SAFE_INTEGER) - (b.days ?? Number.MAX_SAFE_INTEGER));
}

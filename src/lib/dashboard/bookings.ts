import { vendorHref, type VendorCategory, type VendorHref } from "@/lib/vendors/catalog";
import { categoryProgress } from "@/lib/vendors/plan";
import type { Vendor } from "@/lib/vendors/schema";
import type { Venue } from "@/lib/venues/schema";

/*
 * « Vos réservations » de l'accueil : où en sont les postes sans lesquels il
 * n'y a pas de mariage. Le lieu vit dans sa propre table (venues).
 */

/** Postes suivis sur l'accueil, dans l'ordre où ils se réservent d'habitude. */
export const ESSENTIAL_BOOKINGS = [
  "venue",
  "catering",
  "photographer",
  "entertainment",
  "officiant",
  "florist",
  "cake",
  "rings",
] as const satisfies readonly ("venue" | VendorCategory)[];
export type EssentialBooking = (typeof ESSENTIAL_BOOKINGS)[number];

export type BookingState =
  | { key: EssentialBooking; href: VendorHref | "/venues"; status: "booked"; name: string }
  | { key: EssentialBooking; href: VendorHref | "/venues"; status: "leads"; leads: number }
  | { key: EssentialBooking; href: VendorHref | "/venues"; status: "none" };

export function essentialBookings(vendors: readonly Vendor[], venues: readonly Venue[]): BookingState[] {
  const progress = categoryProgress(vendors);
  return ESSENTIAL_BOOKINGS.map((key) => {
    const href = key === "venue" ? "/venues" : vendorHref(key);
    const { booked, leads } =
      key === "venue"
        ? {
            booked: venues.filter((venue) => venue.status === "booked").map((venue) => venue.name),
            leads: venues.filter((venue) => venue.status !== "booked" && venue.status !== "declined").length,
          }
        : progress[key];
    if (booked.length > 0) return { key, href, status: "booked", name: booked.join(", ") };
    if (leads > 0) return { key, href, status: "leads", leads };
    return { key, href, status: "none" };
  });
}

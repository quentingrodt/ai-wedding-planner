import { describe, expect, it } from "vitest";
import type { Vendor } from "@/lib/vendors/schema";
import type { Venue } from "@/lib/venues/schema";
import { ESSENTIAL_BOOKINGS, essentialBookings } from "./bookings";

const vendor = (category: Vendor["category"], status: Vendor["status"], name: string = category) =>
  ({ id: `${category}-${name}`, category, status, name }) as Vendor;
const venue = (status: Venue["status"], name = "Domaine") => ({ id: name, status, name }) as Venue;

describe("essentialBookings", () => {
  it("couvre chaque poste essentiel, à trouver par défaut", () => {
    const bookings = essentialBookings([], []);
    expect(bookings.map((booking) => booking.key)).toEqual([...ESSENTIAL_BOOKINGS]);
    expect(bookings.every((booking) => booking.status === "none")).toBe(true);
    expect(bookings[0].href).toBe("/venues");
    expect(bookings[1].href).toBe("/vendors/catering");
  });

  it("distingue réservé, pistes en cours et pistes écartées", () => {
    const bookings = essentialBookings(
      [
        vendor("catering", "booked", "Maison Blanc"),
        vendor("catering", "quote"),
        vendor("photographer", "contacted"),
        vendor("photographer", "meeting"),
        vendor("florist", "declined"),
      ],
      [venue("visited", "Château"), venue("declined", "Ferme")],
    );
    const byKey = Object.fromEntries(bookings.map((booking) => [booking.key, booking]));
    expect(byKey.catering).toMatchObject({ status: "booked", name: "Maison Blanc" });
    expect(byKey.photographer).toMatchObject({ status: "leads", leads: 2 });
    expect(byKey.florist).toMatchObject({ status: "none" });
    expect(byKey.venue).toMatchObject({ status: "leads", leads: 1 });
  });

  it("retient le lieu réservé", () => {
    const [venueBooking] = essentialBookings([], [venue("shortlisted", "Ferme"), venue("booked", "Château")]);
    expect(venueBooking).toMatchObject({ status: "booked", name: "Château" });
  });
});

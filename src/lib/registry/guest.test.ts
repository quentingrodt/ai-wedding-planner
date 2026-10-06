import { describe, expect, it } from "vitest";
import { availableFor, fundProgress, guestRegistrySchema, type GuestRegistryGift } from "./guest";
import { fundTotals, type RegistryPledge } from "./schema";

const gift = (overrides: Partial<GuestRegistryGift>): GuestRegistryGift => ({
  id: crypto.randomUUID(),
  section: "table",
  title: "Verres à vin",
  description: null,
  price: 15,
  quantity: 6,
  url: null,
  image_url: null,
  is_heirloom: false,
  reserved: 0,
  participants: 0,
  mine: false,
  mine_quantity: null,
  mine_amount: null,
  ...overrides,
});

describe("liste vue par un invité", () => {
  it("compte les exemplaires encore libres, les siens compris", () => {
    expect(availableFor(gift({ reserved: 4 }))).toBe(2);
    expect(availableFor(gift({ reserved: 4, mine: true, mine_quantity: 2 }))).toBe(4);
    expect(availableFor(gift({ quantity: 1, reserved: 1 }))).toBe(0);
    // Les mariés ont réduit la quantité sous les réservations : jamais négatif.
    expect(availableFor(gift({ quantity: 2, reserved: 3 }))).toBe(0);
  });

  it("calcule l'avancement d'un projet, plafonné à 100 %", () => {
    expect(fundProgress({ goal: 3000, raised: 750 })).toBe(0.25);
    expect(fundProgress({ goal: 100, raised: 250 })).toBe(1);
    expect(fundProgress({ goal: null, raised: 250 })).toBeNull();
  });

  it("lit la réponse de get_guest_registry", () => {
    const parsed = guestRegistrySchema.safeParse({
      first_name: "Zoé",
      wedding_title: "Camille & Thomas",
      currency: "EUR",
      note: null,
      accepts_suggestions: true,
      payment_link: "https://paypal.me/camille",
      payment_details: null,
      gifts: [gift({})],
      funds: [
        {
          id: crypto.randomUUID(),
          kind: "honeymoon",
          title: "Notre voyage de noces",
          description: null,
          goal: 3000,
          raised: 120,
          mine_amount: null,
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("urne côté mariés", () => {
  it("additionne les participations d'un projet", () => {
    const pledge = (fundId: string | null, amount: number | null): RegistryPledge => ({
      id: crypto.randomUUID(),
      guest_id: crypto.randomUUID(),
      gift_id: fundId ? null : crypto.randomUUID(),
      fund_id: fundId,
      quantity: null,
      amount,
      message: null,
      created_at: "2027-01-01T00:00:00Z",
      guests: null,
    });
    const fundId = crypto.randomUUID();
    expect(fundTotals([pledge(fundId, 50), pledge(fundId, 120), pledge(null, 30)], fundId)).toEqual({
      raised: 170,
      contributors: 2,
    });
  });
});

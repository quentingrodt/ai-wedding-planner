import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { VENDOR_CATEGORIES } from "./catalog";
import { DETAIL_FIELDS, detailsSchema, QUESTION_COUNTS, readDetails } from "./details";
import { instalments, paymentSummary, upcomingPayments } from "./payments";
import { vendorChecks } from "./plan";
import { planCategoryFor, readPlan } from "./plans";
import type { Vendor } from "./schema";
import {
  cakePortions,
  departureMonth,
  destinationsFor,
  drinkQuantity,
  gettingReadySchedule,
  suggestCakeTiers,
  suggestedQuantity,
  websiteCoveredByCeleste,
} from "./tools";

const vendor = (overrides: Partial<Vendor> = {}): Vendor => ({
  id: "v1",
  category: "photographer",
  name: "Lumière",
  status: "booked",
  contact_name: null,
  phone: null,
  email: null,
  url: null,
  location: null,
  price: 2400,
  price_basis: "total",
  deposit: null,
  deposit_due: null,
  deposit_paid: false,
  second_payment: null,
  second_due: null,
  second_paid: false,
  balance_due: null,
  balance_paid: false,
  meeting_date: null,
  rating: null,
  details: {},
  pros: [],
  cons: [],
  notes: null,
  position: 0,
  ...overrides,
});

describe("guides des prestataires", () => {
  it.each([
    ["fr", fr],
    ["en", en],
  ])("a en %s le bon nombre de questions, des conseils et un libellé par détail", (_, messages) => {
    const { categories, details, options } = messages.Vendors;
    for (const category of VENDOR_CATEGORIES) {
      const entry = categories[category];
      expect(entry.questions.split("|"), category).toHaveLength(QUESTION_COUNTS[category]);
      expect(entry.tips, category).toBeTruthy();
      for (const field of DETAIL_FIELDS[category]) {
        expect((details as Record<string, Record<string, string>>)[category]?.[field.key], `${category}.${field.key}`).toBeTruthy();
        if (field.kind === "select") {
          for (const option of field.options) {
            expect((options as unknown as Record<string, Record<string, string>>)[field.key]?.[option], `${field.key}.${option}`).toBeTruthy();
          }
        }
      }
    }
  });
});

describe("détails d'une fiche", () => {
  it("garde les champs de la catégorie, retire les vides et range les questions posées", () => {
    const parsed = detailsSchema("bridal_gown").parse({ model: "Aurore", size: "", silhouette: "empire", asked: [3, 1, 3] });
    expect(parsed).toEqual({ model: "Aurore", silhouette: "empire", asked: [1, 3] });
  });

  it("refuse un champ d'une autre catégorie ou une question qui n'existe pas", () => {
    expect(detailsSchema("cake").safeParse({ silhouette: "empire" }).success).toBe(false);
    expect(detailsSchema("cake").safeParse({ asked: [QUESTION_COUNTS.cake] }).success).toBe(false);
  });

  it("lit une fiche abîmée sans perdre ce qui est lisible", () => {
    expect(readDetails("photographer", { hours: 10, photos: "beaucoup", asked: [0, 2] })).toEqual({ hours: 10, asked: [0, 2] });
    expect(readDetails("photographer", null)).toEqual({});
  });
});

describe("échéancier", () => {
  it("calcule le solde à partir du prix convenu et des versements", () => {
    const list = instalments(vendor({ deposit: 720, deposit_paid: true, second_payment: 800 }), null);
    expect(list.map(({ kind, amount }) => [kind, amount])).toEqual([
      ["deposit", 720],
      ["second", 800],
      ["balance", 880],
    ]);
    expect(paymentSummary(vendor({ deposit: 720, deposit_paid: true, second_payment: 800 }), null)).toMatchObject({
      paid: 720,
      remaining: 1680,
    });
  });

  it("multiplie un prix par invité avant de déduire les versements", () => {
    const list = instalments(vendor({ price: 85, price_basis: "per_guest", deposit: 3000 }), 100);
    expect(list.at(-1)).toMatchObject({ kind: "balance", amount: 5500 });
  });

  it("signale un versement en retard et rappelle celui qui approche", () => {
    const checks = vendorChecks(
      vendor({ deposit: 500, deposit_due: "2026-10-01", second_payment: 900, second_due: "2026-10-12" }),
      { guestCount: null, envelope: null, today: "2026-10-07" },
    );
    expect(checks).toEqual([
      { tone: "watch", key: "paymentLate", amount: 500, instalment: "deposit" },
      { tone: "hint", key: "paymentSoon", amount: 900, days: 5, instalment: "second" },
    ]);
  });

  it("liste les versements à venir des prestataires réservés, en retard d'abord", () => {
    const upcoming = upcomingPayments(
      [
        vendor({ id: "a", deposit: 300, deposit_due: "2026-11-01" }),
        vendor({ id: "b", deposit: 200, deposit_due: "2026-09-01", price: null }),
        vendor({ id: "c", status: "quote", deposit: 100, deposit_due: "2026-10-08" }),
      ],
      null,
      "2026-10-07",
    );
    expect(upcoming.map(({ vendor: { id }, kind }) => `${id}:${kind}`)).toEqual(["b:deposit", "a:deposit", "a:balance"]);
  });
});

describe("outils", () => {
  it("estime les boissons pour 100 invités", () => {
    expect(drinkQuantity("champagne", 100)).toEqual({ min: 25, max: 34 });
    expect(drinkQuantity("red", 100)).toEqual({ min: 50, max: 50 });
    expect(drinkQuantity("beer", 100)).toEqual({ min: 400, max: 400 });
    expect(drinkQuantity("cocktails", 100)).toEqual({ min: 15, max: 15 });
    expect(drinkQuantity("soft", 100)).toEqual({ min: 25, max: 25 });
    expect(drinkQuantity("water", 0)).toEqual({ min: 0, max: 0 });
  });

  it("compte les parts et suggère des étages pour tous les invités", () => {
    expect(cakePortions([15, 20, 25], "round")).toBe(78);
    expect(cakePortions([15, 20, 25], "square")).toBe(100);
    expect(suggestCakeTiers(60, "round")).toEqual([15, 20, 23]);
    expect(suggestCakeTiers(60, "square")).toEqual([15, 20, 23]);
    expect(suggestCakeTiers(500, "round")).toEqual([15, 20, 23, 25, 30, 35]);
  });

  it("planifie le matin : la mariée en dernier, fin 45 minutes avant", () => {
    const schedule = gettingReadySchedule(
      [
        { name: "Camille", hair: true, makeup: true },
        { name: "Léa", hair: true, makeup: false },
        { name: "Inès", hair: false, makeup: true },
      ],
      "14:00",
      { hair: 45, makeup: 30 },
    );
    expect(schedule.hair).toEqual([
      { name: "Léa", start: "11:45", end: "12:30" },
      { name: "Camille", start: "12:30", end: "13:15" },
    ]);
    expect(schedule.makeup).toEqual([
      { name: "Inès", start: "12:15", end: "12:45" },
      { name: "Camille", start: "12:45", end: "13:15" },
    ]);
    expect(schedule.start).toBe("11:45");
  });

  it("conseille les quantités de papeterie d'après les invités et le plan de table", () => {
    const context = { households: 48, guests: 120, tables: 12 };
    expect(suggestedQuantity("invitations", context)).toBe(48);
    expect(suggestedQuantity("placeCards", context)).toBe(120);
    expect(suggestedQuantity("tableNumbers", context)).toBe(12);
    expect(suggestedQuantity("guestbook", context)).toBe(1);
    expect(suggestedQuantity("ceremonyPrograms", context)).toBeNull();
  });

  it("reconnaît ce que le lien personnel des invités assure déjà", () => {
    const covered = websiteCoveredByCeleste({ hasGuests: true, hasRegistry: true, sharesLodging: false, hasDate: true });
    expect([...covered].sort()).toEqual(["essentials", "registry", "rsvp"]);
  });

  it("propose les destinations du mois de départ", () => {
    expect(departureMonth("2027-07-10", "2026-10-07")).toBe(7);
    expect(departureMonth("2027-04-30", "2026-10-07")).toBe(5);
    expect(departureMonth(null, "2026-10-07")).toBe(10);
    expect(destinationsFor(4)).toEqual(["maldives", "kyoto", "philippines"]);
    expect(destinationsFor(8)).toEqual(["santorini", "boraBora"]);
  });
});

describe("carnets", () => {
  it("lit un carnet vide ou abîmé sans erreur", () => {
    expect(readPlan("cake", undefined)).toEqual({ shape: "round", tiers: [] });
    expect(readPlan("cake", { shape: "oval", tiers: [20, 99, 15, 20] })).toEqual({ shape: "round", tiers: [15, 20] });
    expect(readPlan("hair", { readyBy: "14:00", people: [{ name: "Camille", hair: true, makeup: true }, { name: "" }] })).toMatchObject({
      readyBy: "14:00",
      hairMinutes: 45,
      people: [{ name: "Camille", hair: true, makeup: true }],
    });
  });

  it("partage le planning du matin entre coiffeur et maquilleuse", () => {
    expect(planCategoryFor("makeup")).toBe("hair");
    expect(planCategoryFor("hair")).toBe("hair");
    expect(planCategoryFor("florist")).toBeNull();
  });
});

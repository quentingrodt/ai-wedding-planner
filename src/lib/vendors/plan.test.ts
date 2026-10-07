import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { TASK_CATALOG } from "@/lib/planning/catalog";
import {
  categoryFromSlug,
  VENDOR_CATALOG,
  VENDOR_CATEGORIES,
  VENDOR_SECTIONS,
  VENDOR_STATUSES,
  vendorHref,
  vendorSlug,
} from "./catalog";
import { budgetEnvelope, categoryProgress, sortVendors, vendorChecks, vendorTotal } from "./plan";
import { toVendorRow, vendorInputSchema, type Vendor } from "./schema";

const vendor = (overrides: Partial<Vendor> = {}): Vendor => ({
  id: "v1",
  category: "catering",
  name: "Maison Lenôtre",
  status: "idea",
  contact_name: null,
  phone: null,
  email: null,
  url: null,
  location: null,
  price: null,
  price_basis: "total",
  deposit: null,
  deposit_paid: false,
  meeting_date: null,
  rating: null,
  pros: [],
  cons: [],
  notes: null,
  position: 0,
  ...overrides,
});

describe("catalogue des prestataires", () => {
  it.each([
    ["fr", fr],
    ["en", en],
  ])("a des libellés et conseils %s pour chaque catégorie, statut et entrée du menu", (_, messages) => {
    const { categories, statuses } = messages.Vendors;
    for (const category of VENDOR_CATEGORIES) {
      const entry = categories[category];
      for (const field of ["label", "title", "intro", "when", "questions"] as const) {
        expect(entry[field], `${category}.${field}`).toBeTruthy();
      }
      expect(entry.questions.split("|").length, category).toBeGreaterThanOrEqual(3);
      expect(messages.AppNav.items[`vendor_${category}`], category).toBeTruthy();
    }
    for (const status of VENDOR_STATUSES) expect(statuses[status], status).toBeTruthy();
  });

  it("range chaque catégorie dans une section de la vue d'ensemble, une seule fois", () => {
    const listed = VENDOR_SECTIONS.flatMap((section) => section.categories);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual([...VENDOR_CATEGORIES].sort());
  });

  it("ne coche que des étapes qui existent dans le rétroplanning", () => {
    const keys = new Set<string>(TASK_CATALOG.map((task) => task.key));
    for (const category of VENDOR_CATEGORIES) {
      for (const task of VENDOR_CATALOG[category].tasks) expect(keys.has(task), `${category}: ${task}`).toBe(true);
    }
  });

  it("fait l'aller-retour entre catégorie et adresse", () => {
    expect(vendorSlug("guest_gifts")).toBe("guest-gifts");
    expect(vendorHref("bridal_gown")).toBe("/vendors/bridal-gown");
    for (const category of VENDOR_CATEGORIES) expect(categoryFromSlug(vendorSlug(category))).toBe(category);
    expect(categoryFromSlug("guest_gifts")).toBeNull();
    expect(categoryFromSlug("unknown")).toBeNull();
  });

  it("renvoie les étapes du rétroplanning vers des pages prestataires existantes", () => {
    for (const task of TASK_CATALOG) {
      const href = (task as { href?: string }).href;
      if (href?.startsWith("/vendors/")) expect(categoryFromSlug(href.slice(9)), task.key).not.toBeNull();
    }
  });
});

describe("coûts", () => {
  it("multiplie un prix par invité, garde un prix total", () => {
    expect(vendorTotal({ price: 85, price_basis: "per_guest" }, 120)).toBe(10_200);
    expect(vendorTotal({ price: 85, price_basis: "per_guest" }, null)).toBeNull();
    expect(vendorTotal({ price: 2400, price_basis: "total" }, null)).toBe(2400);
    expect(vendorTotal({ price: null, price_basis: "total" }, 120)).toBeNull();
  });

  it("additionne les lignes du budget d'un poste", () => {
    expect(
      budgetEnvelope(
        [
          { category: "beauty", estimated_amount: 400 },
          { category: "beauty", estimated_amount: 250 },
          { category: "catering", estimated_amount: 9000 },
        ],
        "beauty",
      ),
    ).toBe(650);
    expect(budgetEnvelope([], "beauty")).toBeNull();
  });
});

describe("constats", () => {
  const context = { guestCount: 100, envelope: 8000, today: "2026-10-07" };

  it("signale un devis au-dessus du budget et un acompte à verser", () => {
    expect(
      vendorChecks(vendor({ status: "booked", price: 90, price_basis: "per_guest", deposit: 2700 }), context),
    ).toEqual([
      { tone: "watch", key: "overBudget", over: 1000 },
      { tone: "watch", key: "depositDue", amount: 2700 },
    ]);
  });

  it("prépare un rendez-vous proche et réclame un devis", () => {
    expect(vendorChecks(vendor({ status: "contacted", meeting_date: "2026-10-10" }), context)).toEqual([
      { tone: "hint", key: "meetingSoon", days: 3 },
      { tone: "hint", key: "askQuote" },
    ]);
  });

  it("se tait sur une piste écartée ou un acompte versé", () => {
    expect(vendorChecks(vendor({ status: "declined", price: 99_999 }), context)).toEqual([]);
    expect(vendorChecks(vendor({ status: "booked", deposit: 500, deposit_paid: true }), context)).toEqual([]);
  });
});

describe("avancement", () => {
  it("trie réservés, puis par avancement et note, écartés à la fin", () => {
    const sorted = sortVendors([
      vendor({ id: "declined", status: "declined", rating: 5 }),
      vendor({ id: "quote-low", status: "quote", rating: 2 }),
      vendor({ id: "quote-high", status: "quote", rating: 5 }),
      vendor({ id: "booked", status: "booked" }),
    ]);
    expect(sorted.map(({ id }) => id)).toEqual(["booked", "quote-high", "quote-low", "declined"]);
  });

  it("résume chaque catégorie : réservés et pistes en cours", () => {
    const progress = categoryProgress([
      vendor({ category: "florist", status: "booked", name: "Pivoine" }),
      vendor({ category: "florist", status: "quote" }),
      vendor({ category: "florist", status: "declined" }),
    ]);
    expect(progress.florist).toEqual({ booked: ["Pivoine"], leads: 1 });
    expect(progress.cake).toEqual({ booked: [], leads: 0 });
  });
});

describe("saisie", () => {
  const input = {
    name: " Pivoine & Cie ",
    status: "quote" as const,
    contactName: "",
    phone: "06 12 34 56 78",
    email: "",
    url: "",
    location: "",
    price: 1800,
    priceBasis: "total" as const,
    deposit: null,
    depositPaid: false,
    meetingDate: "",
    rating: 4,
    pros: ["Fleurs de saison", " "],
    cons: [],
    notes: "",
  };

  it("vide les champs non renseignés", () => {
    expect(toVendorRow(vendorInputSchema.parse(input))).toMatchObject({
      name: "Pivoine & Cie",
      email: null,
      phone: "06 12 34 56 78",
      price_basis: "total",
      pros: ["Fleurs de saison"],
    });
  });

  it("refuse une adresse email invalide", () => {
    expect(vendorInputSchema.safeParse({ ...input, email: "pivoine" }).success).toBe(false);
    expect(vendorInputSchema.safeParse({ ...input, email: "contact@pivoine.fr" }).success).toBe(true);
  });
});

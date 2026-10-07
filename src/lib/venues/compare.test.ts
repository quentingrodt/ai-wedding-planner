import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import {
  VENUE_CATERINGS,
  VENUE_CRITERIA,
  VENUE_DATE_STATUSES,
  VENUE_STATUSES,
  VENUE_STYLES,
} from "./catalog";
import {
  bestRatings,
  expectedGuests,
  isEarlyCurfew,
  sortVenues,
  venueBudgetEnvelope,
  venueChecks,
  venueScore,
} from "./compare";
import { toVenueRow, venueInputSchema, type Venue } from "./schema";

const venue = (overrides: Partial<Venue> = {}): Venue => ({
  id: "v1",
  name: "Domaine des Tilleuls",
  status: "idea",
  url: null,
  visit_date: null,
  location: null,
  travel_minutes: null,
  capacity: null,
  price: null,
  style: null,
  beds: null,
  accommodation_note: null,
  catering: null,
  curfew: null,
  restrictions: null,
  date_status: null,
  dates_note: null,
  rating_location: null,
  rating_capacity: null,
  rating_budget: null,
  rating_style: null,
  rating_accommodation: null,
  rating_service: null,
  rating_restrictions: null,
  rating_flexibility: null,
  pros: [],
  cons: [],
  notes: null,
  position: 0,
  ...overrides,
});

const context = { guestCount: 120, venueBudget: 10_000, ambiance: "chateau" };

describe("libellés des lieux", () => {
  it.each([
    ["fr", fr],
    ["en", en],
  ])("a un libellé %s pour chaque critère et chaque valeur", (_, messages) => {
    const { criteria, statuses, styles, caterings, dateStatuses } = messages.Venues;
    for (const criterion of VENUE_CRITERIA) {
      expect(criteria[criterion].label, criterion).toBeTruthy();
      expect(criteria[criterion].questions, criterion).toBeTruthy();
    }
    for (const status of VENUE_STATUSES) expect(statuses[status], status).toBeTruthy();
    for (const style of VENUE_STYLES) expect(styles[style], style).toBeTruthy();
    for (const catering of VENUE_CATERINGS) expect(caterings[catering], catering).toBeTruthy();
    for (const status of VENUE_DATE_STATUSES) expect(dateStatuses[status], status).toBeTruthy();
  });
});

describe("note d'un lieu", () => {
  it("fait la moyenne des seuls critères notés, au dixième", () => {
    expect(venueScore(venue({ rating_location: 5, rating_budget: 4, rating_style: 4 }))).toEqual({
      score: 4.3,
      rated: 3,
    });
  });

  it("n'a pas de note tant qu'aucun critère n'est noté", () => {
    expect(venueScore(venue())).toEqual({ score: null, rated: 0 });
  });
});

describe("constats sur un lieu", () => {
  it("signale une capacité insuffisante et un dépassement d'enveloppe", () => {
    const checks = venueChecks(venue({ capacity: 100, price: 12_500 }), context);
    expect(checks).toEqual([
      { criterion: "capacity", tone: "watch", key: "tooSmall", missing: 20 },
      { criterion: "budget", tone: "watch", key: "overBudget", over: 2500 },
    ]);
  });

  it("rassure quand le lieu accueille tout le monde dans le budget et l'ambiance", () => {
    const checks = venueChecks(
      venue({ capacity: 150, price: 9000, style: "chateau", beds: 130, date_status: "available" }),
      context,
    );
    expect(checks.map(({ key }) => key)).toEqual([
      "fits",
      "withinBudget",
      "matchesStyle",
      "everyoneSleeps",
      "dateFree",
    ]);
  });

  it("relève un traiteur imposé, une fin de soirée avant minuit et une date prise", () => {
    const checks = venueChecks(
      venue({ catering: "imposed", curfew: "23:00:00", date_status: "unavailable" }),
      context,
    );
    expect(checks).toEqual([
      { criterion: "service", tone: "watch", key: "imposedCaterer" },
      { criterion: "restrictions", tone: "watch", key: "earlyCurfew", time: "23:00" },
      { criterion: "flexibility", tone: "watch", key: "dateTaken" },
    ]);
  });

  it("ne compare rien sans donnée du mariage", () => {
    const checks = venueChecks(venue({ capacity: 80, price: 5000 }), {
      guestCount: null,
      venueBudget: null,
      ambiance: null,
    });
    expect(checks).toEqual([]);
  });

  it("ne voit pas de couvre-feu dans une fin de soirée après minuit", () => {
    expect(isEarlyCurfew("02:00")).toBe(false);
    expect(isEarlyCurfew("00:30")).toBe(false);
    expect(isEarlyCurfew("22:00")).toBe(true);
  });
});

describe("données du mariage", () => {
  it("prend les lignes « lieu » du budget, sinon 40 % du budget total", () => {
    expect(
      venueBudgetEnvelope(
        [
          { category: "venue", estimated_amount: 6000 },
          { category: "venue", estimated_amount: 1500 },
          { category: "catering", estimated_amount: 9000 },
        ],
        30_000,
      ),
    ).toBe(7500);
    expect(venueBudgetEnvelope([{ category: "venue", estimated_amount: 0 }], 30_000)).toBe(12_000);
    expect(venueBudgetEnvelope([], null)).toBeNull();
  });

  it("retient le plus grand nombre entre la liste et l'estimation", () => {
    expect(expectedGuests(40, 120)).toBe(120);
    expect(expectedGuests(140, 120)).toBe(140);
    expect(expectedGuests(0, null)).toBeNull();
  });
});

describe("comparaison", () => {
  it("garde la meilleure note de chaque critère", () => {
    const best = bestRatings([venue({ rating_location: 3 }), venue({ rating_location: 5, rating_style: 2 })]);
    expect(best.location).toBe(5);
    expect(best.style).toBe(2);
    expect(best.budget).toBeNull();
  });

  it("place le lieu retenu en tête, les lieux écartés à la fin", () => {
    const sorted = sortVenues([
      venue({ id: "declined", status: "declined", rating_location: 5 }),
      venue({ id: "low", status: "visited", rating_location: 2 }),
      venue({ id: "high", status: "visited", rating_location: 5 }),
      venue({ id: "booked", status: "booked" }),
    ]);
    expect(sorted.map(({ id }) => id)).toEqual(["booked", "high", "low", "declined"]);
  });
});

describe("saisie d'un lieu", () => {
  const input = {
    name: "  Château de Vaux  ",
    url: "",
    visitDate: "",
    location: "",
    travelMinutes: null,
    capacity: 150,
    price: null,
    style: null,
    beds: null,
    accommodationNote: "",
    catering: null,
    curfew: "02:00",
    restrictions: "",
    dateStatus: null,
    datesNote: "",
    ratings: { location: 4 },
    pros: ["Parc magnifique", "  "],
    cons: [],
    notes: "",
  };

  it("vide les champs non renseignés et les entrées blanches", () => {
    const parsed = venueInputSchema.parse(input);
    const row = toVenueRow(parsed);
    expect(row).toMatchObject({
      name: "Château de Vaux",
      url: null,
      location: null,
      curfew: "02:00",
      rating_location: 4,
      rating_budget: null,
      pros: ["Parc magnifique"],
    });
    expect(row).not.toHaveProperty("status");
  });

  it("refuse le statut « réservé », réservé au choix final", () => {
    expect(venueInputSchema.safeParse({ ...input, status: "booked" }).success).toBe(false);
    expect(venueInputSchema.safeParse({ ...input, status: "visited" }).success).toBe(true);
  });
});

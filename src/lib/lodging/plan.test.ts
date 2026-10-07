import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { LODGING_KINDS, LODGING_STATUSES, LODGING_TIPS } from "./catalog";
import {
  bookingTimeline,
  groupLeverage,
  lodgingChecks,
  lodgingNeeds,
  securedRooms,
  sortLodgings,
} from "./plan";
import { guestRsvpSchema } from "@/lib/rsvp/schema";
import { lodgingInputSchema, toLodgingRow, type Lodging } from "./schema";

const lodging = (overrides: Partial<Lodging> = {}): Lodging => ({
  id: "l1",
  name: "Hôtel de la Poste",
  kind: "hotel",
  status: "idea",
  location: null,
  travel_minutes: null,
  rooms: null,
  price_per_night: null,
  group_rate: false,
  booking_code: null,
  deadline: null,
  url: null,
  contact: null,
  notes: null,
  position: 0,
  ...overrides,
});

const guest = (familyId: string | null, overrides: { is_child?: boolean; status?: "declined" | "confirmed"; needs_lodging?: boolean } = {}) => ({
  family_id: familyId,
  is_child: overrides.is_child ?? false,
  status: overrides.status ?? "confirmed",
  needs_lodging: overrides.needs_lodging ?? true,
});

describe("libellés de l'hébergement", () => {
  it.each([
    ["fr", fr],
    ["en", en],
  ])("a un libellé %s pour chaque type, statut et astuce", (_, messages) => {
    const { kinds, statuses, tips } = messages.Lodging;
    for (const kind of LODGING_KINDS) expect(kinds[kind], kind).toBeTruthy();
    for (const status of LODGING_STATUSES) expect(statuses[status], status).toBeTruthy();
    for (const tip of LODGING_TIPS) expect(tips[tip].title, tip).toBeTruthy();
  });
});

describe("besoins", () => {
  it("loge un foyer à deux adultes par chambre, enfants compris, et chaque invité seul à part", () => {
    expect(
      lodgingNeeds([
        // Famille A : deux parents et deux enfants → 1 chambre.
        guest("a"),
        guest("a"),
        guest("a", { is_child: true }),
        guest("a", { is_child: true }),
        // Famille B : trois adultes → 2 chambres.
        guest("b"),
        guest("b"),
        guest("b"),
        // Un invité seul → 1 chambre.
        guest(null),
      ]),
    ).toEqual({ people: 8, rooms: 4 });
  });

  it("ignore les invités qui ne viennent pas de loin ou ont décliné", () => {
    expect(
      lodgingNeeds([guest(null, { needs_lodging: false }), guest(null, { status: "declined" })]),
    ).toEqual({ people: 0, rooms: 0 });
  });
});

describe("calendrier de réservation", () => {
  it("donne la date où bloquer les chambres quand le mariage est loin", () => {
    expect(bookingTimeline("2027-07-10", "2026-10-07")).toEqual({
      phase: "early",
      blockBy: "2026-10-13",
      guestsBy: "2027-05-26",
      highSeason: true,
    });
  });

  it("presse quand il reste moins de 9 mois, puis moins de 3 mois", () => {
    expect(bookingTimeline("2027-03-06", "2026-10-07")).toMatchObject({ phase: "now", highSeason: false });
    expect(bookingTimeline("2026-12-01", "2026-10-07")).toEqual({
      phase: "late",
      guestsBy: "2026-10-17",
      highSeason: false,
    });
    expect(bookingTimeline("2026-11-01", "2026-10-07")).toMatchObject({ phase: "late", guestsBy: null });
  });

  it("n'a rien à dire sans date, ni une fois le mariage passé", () => {
    expect(bookingTimeline(null, "2026-10-07")).toEqual({ phase: "noDate" });
    expect(bookingTimeline("2026-10-07", "2026-10-07")).toEqual({ phase: "past" });
  });
});

describe("tarif de groupe", () => {
  it("se négocie franchement dès 10 chambres, se tente dès 5", () => {
    expect(groupLeverage(12)).toBe("strong");
    expect(groupLeverage(6)).toBe("possible");
    expect(groupLeverage(2)).toBe("small");
  });
});

describe("hébergements", () => {
  it("compte les chambres en option ou confirmées", () => {
    expect(
      securedRooms([
        lodging({ status: "option", rooms: 8 }),
        lodging({ status: "confirmed", rooms: 4 }),
        lodging({ status: "contacted", rooms: 10 }),
        lodging({ status: "confirmed", rooms: null }),
      ]),
    ).toBe(12);
  });

  it("relance une option qui expire et conseille le tarif de groupe", () => {
    expect(lodgingChecks(lodging({ status: "option", rooms: 8, deadline: "2026-10-15" }), "2026-10-07")).toEqual([
      { tone: "watch", key: "deadlineSoon", days: 8 },
      { tone: "hint", key: "askGroupRate" },
    ]);
    expect(lodgingChecks(lodging({ status: "option", deadline: "2026-10-01" }), "2026-10-07")).toEqual([
      { tone: "watch", key: "optionExpired" },
    ]);
  });

  it("rappelle le code à transmettre et la navette pour un hébergement éloigné", () => {
    expect(
      lodgingChecks(lodging({ status: "confirmed", group_rate: true, travel_minutes: 35 }), "2026-10-07"),
    ).toEqual([
      { tone: "hint", key: "shareCode" },
      { tone: "hint", key: "shuttle", minutes: 35 },
    ]);
  });

  it("se tait sur une piste écartée et trie les chambres tenues d'abord", () => {
    expect(lodgingChecks(lodging({ status: "declined", deadline: "2026-01-01" }), "2026-10-07")).toEqual([]);
    const sorted = sortLodgings([
      lodging({ id: "declined", status: "declined" }),
      lodging({ id: "idea", status: "idea" }),
      lodging({ id: "confirmed", status: "confirmed" }),
    ]);
    expect(sorted.map(({ id }) => id)).toEqual(["confirmed", "idea", "declined"]);
  });
});

describe("saisie d'un hébergement", () => {
  it("vide les champs non renseignés", () => {
    const row = toLodgingRow(
      lodgingInputSchema.parse({
        name: " Gîte du Moulin ",
        kind: "gite",
        status: "idea",
        location: "",
        travelMinutes: 10,
        rooms: 5,
        pricePerNight: null,
        groupRate: false,
        bookingCode: "",
        deadline: "",
        url: "",
        contact: "",
        notes: "",
      }),
    );
    expect(row).toMatchObject({ name: "Gîte du Moulin", location: null, deadline: null, rooms: 5, booking_code: null });
  });
});

describe("hébergement sur le lien de l'invité", () => {
  const rsvp = {
    first_name: "Camille",
    last_name: null,
    status: "confirmed",
    dietary_requirements: null,
    events: ["ceremony"],
    wedding_title: "Camille & Thomas",
    wedding_date: "2027-07-10",
    design: null,
    has_registry: false,
  };

  it("lit les hébergements partagés, et n'en montre aucun avant la migration 000029", () => {
    expect(guestRsvpSchema.parse(rsvp)).toMatchObject({ lodgings: [], currency: "EUR" });
    const shared = guestRsvpSchema.parse({
      ...rsvp,
      currency: "CHF",
      lodgings: [
        {
          id: "l1",
          name: "Hôtel de la Poste",
          kind: "hotel",
          location: "Beaune",
          travel_minutes: 10,
          price_per_night: 95,
          group_rate: true,
          booking_code: "MARIAGE-CT",
          deadline: "2027-05-26",
          url: "https://example.com",
          contact: null,
        },
      ],
    });
    expect(shared.lodgings[0]).toMatchObject({ name: "Hôtel de la Poste", booking_code: "MARIAGE-CT" });
    expect(shared.currency).toBe("CHF");
  });
});

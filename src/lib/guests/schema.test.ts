import { describe, expect, it } from "vitest";
import {
  addGuestSchema,
  DEFAULT_GUEST_EVENTS,
  summarizeEvents,
  summarizeGuestEvents,
  type Guest,
} from "./schema";

describe("summarizeGuestEvents", () => {
  it("résume la journée par défaut sans la détailler", () => {
    expect(summarizeGuestEvents(DEFAULT_GUEST_EVENTS)).toEqual({ kind: "fullDay", brunch: false });
  });

  it("signale le lendemain en plus de la journée", () => {
    expect(summarizeGuestEvents([...DEFAULT_GUEST_EVENTS, "brunch"])).toEqual({
      kind: "fullDay",
      brunch: true,
    });
  });

  it("détaille une invitation partielle dans l'ordre de la journée", () => {
    expect(summarizeGuestEvents(["dessert", "cocktail"])).toEqual({
      kind: "partial",
      events: ["cocktail", "dessert"],
    });
  });
});

describe("addGuestSchema.events", () => {
  const base = {
    firstName: "Zoé",
    lastName: "",
    status: "invited",
    dietaryRequirements: "",
    isChild: false,
    familyId: null,
  } as const;

  it("trie et dédoublonne les étapes", () => {
    const parsed = addGuestSchema.parse({ ...base, events: ["brunch", "cocktail", "cocktail"] });
    expect(parsed.events).toEqual(["cocktail", "brunch"]);
  });

  it("exige au moins une étape", () => {
    expect(addGuestSchema.safeParse({ ...base, events: [] }).success).toBe(false);
  });
});

describe("summarizeEvents", () => {
  const guest = (status: Guest["status"], events: Guest["events"]): Guest => ({
    id: crypto.randomUUID(),
    first_name: "Invité",
    last_name: null,
    status,
    dietary_requirements: null,
    is_child: false,
    family_id: null,
    events,
    rsvp_token: crypto.randomUUID(),
  });

  it("compte les attendus et les confirmés par étape, sans les déclinés", () => {
    const counts = summarizeEvents([
      guest("confirmed", [...DEFAULT_GUEST_EVENTS]),
      guest("invited", ["cocktail"]),
      guest("tentative", ["cocktail", "brunch"]),
      guest("declined", [...DEFAULT_GUEST_EVENTS, "brunch"]),
    ]);
    expect(counts.cocktail).toEqual({ expected: 3, confirmed: 1 });
    expect(counts.dinner).toEqual({ expected: 1, confirmed: 1 });
    expect(counts.brunch).toEqual({ expected: 1, confirmed: 0 });
  });
});

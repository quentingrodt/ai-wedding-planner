import { describe, expect, it } from "vitest";
import { DEFAULT_PLANNING_ANSWERS } from "@/lib/planning/schema";
import {
  ceremonyOf,
  initialStepTwo,
  mergePlanningAnswers,
  parseGuestList,
  stepTwoSchema,
  venueNames,
  type StepTwoInput,
} from "./step-two";

const input = (overrides: Partial<StepTwoInput> = {}): StepTwoInput => ({ ...initialStepTwo(null), ...overrides });

describe("stepTwoSchema", () => {
  it("accepte une étape laissée vide", () => {
    const parsed = stepTwoSchema.safeParse(input());
    expect(parsed.success).toBe(true);
    expect(parsed.data?.pinterestUrl).toBeNull();
    expect(parsed.data?.vendors.catering).toEqual({ enabled: false, name: "", budget: null });
  });

  it("normalise un tableau Pinterest et refuse un autre lien", () => {
    const ok = stepTwoSchema.safeParse(input({ pinterestUrl: " https://www.pinterest.fr/camille/mariage-champetre/ " }));
    expect(ok.data?.pinterestUrl).toMatch(/^https:\/\/www\.pinterest\.com\/camille\/mariage-champetre\/$/);
    const ko = stepTwoSchema.safeParse(input({ pinterestUrl: "https://example.com/board" }));
    expect(ko.error?.issues[0]).toMatchObject({ path: ["pinterestUrl"], message: "invalidPinterest" });
  });

  it("lit un budget saisi avec des espaces, refuse un texte", () => {
    const vendors = initialStepTwo(null).vendors;
    const ok = stepTwoSchema.safeParse(
      input({ vendors: { ...vendors, catering: { enabled: true, name: "Maison Blanc", budget: "12 500" } } }),
    );
    expect(ok.data?.vendors.catering.budget).toBe(12_500);
    const ko = stepTwoSchema.safeParse(
      input({ vendors: { ...vendors, florist: { enabled: true, name: "Pétales", budget: "environ 800" } } }),
    );
    expect(ko.error?.issues[0]).toMatchObject({ path: ["vendors", "florist", "budget"], message: "invalidAmount" });
  });
});

describe("planning answers", () => {
  it("traduit le type de cérémonie dans les deux sens", () => {
    for (const ceremony of ["civil", "religious", "secular", "both"] as const) {
      const merged = mergePlanningAnswers(null, { ceremony, music: "band", attire: "custom", guestAccommodation: true });
      expect(ceremonyOf(merged)).toBe(ceremony);
    }
  });

  it("garde les autres réponses du questionnaire", () => {
    const merged = mergePlanningAnswers(
      { ...DEFAULT_PLANNING_ANSWERS, honeymoon: false, videographer: true },
      { ceremony: "civil", music: "playlist", attire: "ready", guestAccommodation: false },
    );
    expect(merged).toMatchObject({ honeymoon: false, videographer: true, music: "playlist", attire: "ready" });
  });
});

describe("parseGuestList", () => {
  it("prend le premier mot pour prénom et le reste pour nom", () => {
    expect(parseGuestList("Camille Martin\n\n  Jean   de La Fontaine \nLéa, Paul Durand; Inès")).toEqual([
      { firstName: "Camille", lastName: "Martin" },
      { firstName: "Jean", lastName: "de La Fontaine" },
      { firstName: "Léa", lastName: null },
      { firstName: "Paul", lastName: "Durand" },
      { firstName: "Inès", lastName: null },
    ]);
  });
});

describe("venueNames", () => {
  it("ignore les cases vides et les doublons", () => {
    expect(venueNames(["Château de Vaux", "", "  Château de Vaux ", "La Ferme"])).toEqual(["Château de Vaux", "La Ferme"]);
  });
});

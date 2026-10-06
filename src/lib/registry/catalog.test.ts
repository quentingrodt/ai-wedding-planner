import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { FUND_KINDS, REGISTRY_IDEAS, REGISTRY_SECTIONS } from "./catalog";
import { registryTotal, setUpRegistrySchema } from "./schema";

describe("catalogue de la liste de mariage", () => {
  it.each([
    ["fr", fr],
    ["en", en],
  ])("a un libellé %s pour chaque idée, rubrique et projet", (_, messages) => {
    const { catalog, sections, funds } = messages.Registry;
    for (const { idea } of REGISTRY_IDEAS) expect(catalog.ideas[idea], idea).toBeTruthy();
    for (const section of REGISTRY_SECTIONS) expect(sections[section], section).toBeTruthy();
    for (const kind of FUND_KINDS) expect(funds.kinds[kind].defaultTitle, kind).toBeTruthy();
  });

  it("n'a pas deux idées identiques dans une même rubrique", () => {
    const keys = REGISTRY_IDEAS.map(({ section, idea }) => `${section}:${idea}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("liste de mariage", () => {
  it("additionne prix × quantité, sans compter les prix inconnus", () => {
    expect(
      registryTotal([
        { price: 230, quantity: 1 },
        { price: 12, quantity: 8 },
        { price: null, quantity: 2 },
      ]),
    ).toBe(326);
  });

  it("valide le parcours d'ouverture et normalise les champs vides", () => {
    const parsed = setUpRegistrySchema.parse({
      gifts: [{ section: "kitchen", title: "Une cocotte en fonte", isHeirloom: false }],
      funds: [{ kind: "honeymoon", title: "Notre voyage de noces", description: "", goal: 3000 }],
      note: "  ",
      acceptsSuggestions: true,
      paymentLink: "",
      paymentDetails: "",
    });
    expect(parsed).toMatchObject({ note: null, paymentLink: null, paymentDetails: null });
    expect(parsed.funds[0].description).toBeNull();
  });

  it("refuse un lien de cagnotte non sécurisé", () => {
    const result = setUpRegistrySchema.safeParse({
      gifts: [],
      funds: [],
      note: "",
      acceptsSuggestions: true,
      paymentLink: "http://paypal.me/camille",
      paymentDetails: "",
    });
    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { invitationDesignSchema } from "./schema";
import { monogramInitials, sortTemplatesFor, splitNames } from "./templates";

describe("invitationDesignSchema", () => {
  const v1 = {
    version: 1,
    template: "garden",
    palette: "sage",
    fonts: "romantic",
    content: {
      names: "Camille & Thomas",
      intro: "ont la joie de vous convier",
      dateText: "Samedi 12 juin 2027",
      time: "à seize heures",
      venue: "Domaine des Tilleuls",
      address: "Route des Vignes, Beaune",
      rsvpNote: "Réponse souhaitée avant le 1er mai",
    },
  };

  it("convertit un design v1 : l'heure et le lieu deviennent le premier moment", () => {
    const design = invitationDesignSchema.parse(v1);
    expect(design.version).toBe(2);
    expect(design.content.moments).toEqual([
      {
        time: "à seize heures",
        title: "",
        venue: "Domaine des Tilleuls",
        address: "Route des Vignes, Beaune",
        icon: "church",
      },
    ]);
    expect(design.content.contact).toBe("");
  });

  it("ne crée aucun moment pour un design v1 sans heure ni lieu", () => {
    const design = invitationDesignSchema.parse({
      ...v1,
      content: { ...v1.content, time: "", venue: "", address: "" },
    });
    expect(design.content.moments).toEqual([]);
  });

  it("refuse plus de quatre moments", () => {
    const moment = { time: "", title: "", venue: "", address: "", icon: "glass" };
    const result = invitationDesignSchema.safeParse({
      version: 2,
      template: "chronology",
      palette: "ink",
      fonts: "engraved",
      content: { ...v1.content, moments: Array(5).fill(moment), contact: "" },
    });
    expect(result.success).toBe(false);
  });
});

describe("modèles", () => {
  it("coupe les prénoms autour de l'esperluette ou de « et »", () => {
    expect(splitNames("Pauline & Antoine")).toEqual(["Pauline", "& Antoine"]);
    expect(splitNames("Pauline et Antoine")).toEqual(["Pauline", "et Antoine"]);
    expect(splitNames("Pauline")).toEqual(["Pauline"]);
  });

  it("tire les initiales du monogramme", () => {
    expect(monogramInitials("Pauline & Antoine")).toBe("PA");
    expect(monogramInitials("élise et Marc")).toBe("ÉM");
    expect(monogramInitials("Pauline")).toBe("P");
  });

  it("place les modèles recommandés en tête", () => {
    const sorted = sortTemplatesFor("beach", ["classic", "seaside", "eucalyptus", "loft"]);
    expect(sorted.slice(0, 2)).toEqual(["seaside", "eucalyptus"]);
  });
});

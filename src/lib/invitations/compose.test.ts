import { describe, expect, it } from "vitest";
import {
  cityOf,
  composeInvitation,
  placesFor,
  stylesFor,
  suggestedMoments,
  type CompositionAnswers,
  type CompositionTexts,
} from "./compose";
import { invitationDesignSchema, INVITATION_TEMPLATES } from "./schema";

const texts: CompositionTexts = {
  intro: "vous invitent à célébrer leur union",
  closingNote: "Votre présence sera notre plus beau cadeau.",
  families: "M. et Mme Martin",
  coverDate: "24 · 06 · 2027",
  momentTitles: {
    cityhall: "Cérémonie civile",
    church: "Cérémonie religieuse",
    arch: "Cérémonie laïque",
    glass: "Vin d’honneur",
    dinner: "Dîner",
    cake: "Dessert",
    music: "Soirée dansante",
    brunch: "Brunch du lendemain",
  },
};

const answers: CompositionAnswers = {
  names: "Cédric & Louise",
  dateText: "Samedi 24 juin 2027",
  format: "booklet",
  ambiance: "countryside",
  tone: "modern",
  moments: [
    { icon: "dinner", time: "19h30" },
    { icon: "church", time: "15h00" },
    { icon: "glass", time: "" },
  ],
  places: {
    ceremony: { venue: "Église Saint-Martin", address: "Place de l’Église, Beaune" },
    reception: { venue: "Domaine des Tilleuls", address: "Route des Vignes, 21200 Beaune" },
  },
  families: false,
  rsvpNote: "Réponse souhaitée avant le 2 mai 2027",
  contact: "",
};

describe("composeInvitation", () => {
  it("compose un design valide, dans le style de l'ambiance et du ton", () => {
    const design = composeInvitation(answers, texts);
    expect(invitationDesignSchema.safeParse(design).success).toBe(true);
    expect(design).toMatchObject({ format: "booklet", template: "eucalyptus", fonts: "modern" });
  });

  it("range les moments dans l'ordre de la journée et place chacun dans son lieu", () => {
    const { moments } = composeInvitation(answers, texts).content;
    expect(moments.map((moment) => [moment.icon, moment.time, moment.venue])).toEqual([
      ["church", "15h00", "Église Saint-Martin"],
      ["glass", "", "Domaine des Tilleuls"],
      ["dinner", "19h30", "Domaine des Tilleuls"],
    ]);
    expect(moments[0].title).toBe("Cérémonie religieuse");
  });

  it("met la cérémonie à la réception quand elle n'a pas de lieu propre", () => {
    const { moments } = composeInvitation({ ...answers, places: { reception: answers.places.reception } }, texts).content;
    expect(moments[0].venue).toBe("Domaine des Tilleuls");
  });

  it("compose les repères de couverture avec la ville de la réception", () => {
    expect(composeInvitation(answers, texts).content.coverHint).toBe("24 · 06 · 2027 — Beaune");
  });

  it("n'ajoute l'annonce des familles que sur demande", () => {
    expect(composeInvitation(answers, texts).content.families).toBe("");
    expect(composeInvitation({ ...answers, families: true }, texts).content.families).toBe("M. et Mme Martin");
  });

  it("propose un autre modèle à chaque variante", () => {
    const first = composeInvitation(answers, texts, 0).template;
    const second = composeInvitation(answers, texts, 1).template;
    expect(second).not.toBe(first);
  });
});

describe("aides du questionnaire", () => {
  it("passe en revue tous les modèles, le principal en premier", () => {
    const styles = stylesFor("beach", "classic");
    expect(styles[0].template).toBe("seaside");
    expect(new Set(styles.map((style) => style.template)).size).toBe(INVITATION_TEMPLATES.length);
  });

  it("ne demande que les lieux utiles", () => {
    expect(placesFor(["glass", "church", "dinner"])).toEqual(["ceremony", "reception"]);
  });

  it("propose les moments d'après le type de cérémonie, quatre au plus", () => {
    expect(suggestedMoments({ religious: true, secular: false })).toEqual(["cityhall", "church", "glass", "dinner"]);
    expect(suggestedMoments({ religious: true, secular: true })).toHaveLength(4);
  });

  it("extrait la ville d'une adresse", () => {
    expect(cityOf("Route des Vignes, 21200 Beaune")).toBe("Beaune");
    expect(cityOf("")).toBe("");
  });
});

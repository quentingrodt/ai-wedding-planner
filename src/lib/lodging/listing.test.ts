import { writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildLodgingListing } from "./listing";
import { buildLodgingPdf, type LodgingPdfLabels } from "./pdf";
import type { Lodging, LodgingGuest } from "./schema";

const lodging = (overrides: Partial<Lodging>): Lodging => ({
  id: "l1",
  name: "Hôtel de la Poste",
  kind: "hotel",
  status: "confirmed",
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

let next = 0;
const guest = (first: string, last: string | null, overrides: Partial<LodgingGuest> = {}): LodgingGuest => ({
  id: `g${next++}`,
  first_name: first,
  last_name: last,
  status: "confirmed",
  is_child: false,
  family_id: null,
  needs_lodging: true,
  lodging_id: null,
  ...overrides,
});

const families = [
  { id: "martin", name: "Famille Martin" },
  { id: "bernard", name: "Les Bernard" },
];

const lodgings = [
  lodging({
    id: "poste",
    name: "Hôtel de la Poste",
    location: "Beaune",
    travel_minutes: 12,
    rooms: 2,
    price_per_night: 95,
    group_rate: true,
    booking_code: "MARIAGE-CT",
    deadline: "2027-05-26",
    contact: "Mme Martin, 03 80 00 00 00",
    url: "https://hotel-de-la-poste.example",
    notes: "Petit-déjeuner inclus, parking gratuit dans la cour.",
  }),
  lodging({ id: "moulin", name: "Gîte du Moulin", kind: "gite", status: "option", rooms: 6, position: 1 }),
  lodging({ id: "ferme", name: "Ferme écartée", status: "declined", position: 2 }),
];

const guests = [
  guest("Marie", "Martin", { family_id: "martin", lodging_id: "poste" }),
  guest("Paul", "Martin", { family_id: "martin", lodging_id: "poste" }),
  guest("Léa", "Martin", { family_id: "martin", lodging_id: "poste", is_child: true }),
  guest("Hugo", "Bernard", { family_id: "bernard", lodging_id: "poste" }),
  guest("Inès", "Bernard", { family_id: "bernard", lodging_id: "poste" }),
  guest("Zoé", "Aubert", { lodging_id: "moulin" }),
  guest("Noé", null),
  guest("Chloé", "Durand", { status: "declined", lodging_id: "moulin" }),
  guest("Tom", "Petit", { needs_lodging: false }),
];

describe("répartition des hébergements", () => {
  const listing = buildLodgingListing(lodgings, guests, families, "fr");

  it("liste chaque hébergement avec ses foyers, puis les invités seuls", () => {
    expect(listing.lodgings.map((entry) => entry.lodging.id)).toEqual(["poste", "moulin"]);
    const [poste, moulin] = listing.lodgings;
    expect(poste.households.map((household) => household.name)).toEqual(["Famille Martin", "Les Bernard"]);
    expect(poste.households[0].guests.map((member) => member.displayName)).toEqual([
      "Léa Martin",
      "Marie Martin",
      "Paul Martin",
    ]);
    expect(poste).toMatchObject({ people: 5, rooms: 2 });
    expect(moulin.households).toEqual([
      { name: null, guests: [{ id: expect.any(String), displayName: "Zoé Aubert", indexName: "Aubert, Zoé", isChild: false }] },
    ]);
  });

  it("garde à part ceux qui restent à loger, sans les invités qui ont décliné ni ceux qui rentrent chez eux", () => {
    expect(listing.unassigned.flatMap((household) => household.guests.map((member) => member.displayName))).toEqual([
      "Noé",
    ]);
    expect(listing.totals).toEqual({ people: 7, assigned: 6, unassigned: 1, lodgings: 2 });
  });

  it("indexe tout le monde par nom de famille avec son hébergement", () => {
    expect(listing.index.map((entry) => [entry.indexName, entry.lodgingName])).toEqual([
      ["Aubert, Zoé", "Gîte du Moulin"],
      ["Bernard, Hugo", "Hôtel de la Poste"],
      ["Bernard, Inès", "Hôtel de la Poste"],
      ["Martin, Léa", "Hôtel de la Poste"],
      ["Martin, Marie", "Hôtel de la Poste"],
      ["Martin, Paul", "Hôtel de la Poste"],
      ["Noé", null],
    ]);
  });

  it("garde une piste écartée tant que des invités y sont attribués", () => {
    const withDeclined = buildLodgingListing(lodgings, [guest("Ana", "Roux", { lodging_id: "ferme" })], families, "fr");
    expect(withDeclined.lodgings.map((entry) => entry.lodging.id)).toEqual(["poste", "moulin", "ferme"]);
  });
});

const labels: LodgingPdfLabels = {
  documentTitle: "Hébergement des invités — Camille & Thomas",
  eyebrow: "Hébergement des invités",
  title: "Camille & Thomas",
  subtitle: "samedi 10 juillet 2027",
  summary: "7 invités à loger, répartis dans 2 hébergements ; 1 reste à loger.",
  lodgingsTitle: "Les hébergements",
  noLodgings: "Aucun hébergement enregistré pour l’instant.",
  kindStatus: (entry) => `${entry.kind} · ${entry.status}`,
  occupancy: (people, rooms, planned) => `${people} personnes · ${rooms} chambres sur ${planned ?? "—"} prévues`,
  facts: {
    travel: (minutes) => `${minutes} min du lieu`,
    perNight: (price) => `${price} € la nuit`,
    rooms: (count) => `${count} chambres tenues`,
    groupRate: "Tarif de groupe",
    code: "Code de réservation",
    deadline: "Date limite",
    contact: "Contact",
    url: "Site",
    notes: "Notes",
  },
  date: (iso) => iso,
  residentsTitle: "Qui dort ici",
  nobody: "Personne n’y est encore attribué.",
  child: "enfant",
  unassignedTitle: "Encore à loger",
  unassignedLead: "Ces invités viennent de loin et n’ont pas encore d’hébergement attribué.",
  indexTitle: "Qui dort où",
  toHost: "à loger",
  footer: "Camille & Thomas · Hébergement des invités",
  page: (current, total) => `${current} / ${total}`,
};

describe("export PDF", () => {
  it("compose un document lisible, avec tous les accents", async () => {
    const bytes = await buildLodgingPdf(buildLodgingListing(lodgings, guests, families, "fr"), labels);
    const document = await PDFDocument.load(bytes);
    // Les hébergements, puis l'index sur sa propre page.
    expect(document.getPageCount()).toBe(2);
    expect(document.getTitle()).toBe(labels.documentTitle);
    // Aperçu à relire à l'œil : LODGING_PDF_OUT=chemin.pdf npx vitest run src/lib/lodging
    if (process.env.LODGING_PDF_OUT) await writeFile(process.env.LODGING_PDF_OUT, bytes);
  });

  it("tient sur plusieurs pages avec beaucoup d'invités", async () => {
    const many = Array.from({ length: 160 }, (_, index) =>
      guest(`Invité${index}`, `Nom${index}`, { lodging_id: index % 2 === 0 ? "poste" : "moulin" }),
    );
    const bytes = await buildLodgingPdf(buildLodgingListing(lodgings, many, families, "fr"), labels);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(3);
  });
});

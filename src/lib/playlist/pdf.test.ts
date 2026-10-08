import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildPlaylistPdf, type PlaylistPdfData } from "./pdf";

const data = (tracks: number): PlaylistPdfData => ({
  documentTitle: "Playlist du mariage de Quentin & Aurore",
  eyebrow: "La playlist",
  title: "Quentin & Aurore",
  subtitle: "samedi 12 juin 2027",
  summary: `${tracks} morceaux · 2 h 15 de musique`,
  empty: "Aucun morceau pour l’instant.",
  footer: "Composée avec Céleste",
  page: (current, total) => `${current} / ${total}`,
  groups: [
    {
      label: "L’entrée à la cérémonie",
      avoid: false,
      note: null,
      tracks: Array.from({ length: tracks }, (_, index) => ({
        name: `Morceau n° ${index + 1} — « Élégie »`,
        artist: "Édith Piaf, Œ & Cie",
        duration: "3:27",
      })),
    },
    {
      label: "À ne pas passer",
      avoid: true,
      note: "Merci de ne pas passer ces morceaux.",
      tracks: [{ name: "La Danse des canards", artist: "J.J. Lionel", duration: null }],
    },
  ],
});

describe("buildPlaylistPdf", () => {
  it("produit un PDF lisible, accents compris", async () => {
    const bytes = await buildPlaylistPdf(data(3));
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe("Playlist du mariage de Quentin & Aurore");
  });

  it("passe à la page suivante sur une longue playlist", async () => {
    const pdf = await PDFDocument.load(await buildPlaylistPdf(data(60)));
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it("s'ouvre aussi sans aucun morceau", async () => {
    const pdf = await PDFDocument.load(await buildPlaylistPdf({ ...data(0), groups: [] }));
    expect(pdf.getPageCount()).toBe(1);
  });
});

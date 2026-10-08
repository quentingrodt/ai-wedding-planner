import type { PDFFont, PDFPage, RGB } from "pdf-lib";
import { A4, COLOR, createDocument, fit, wrap } from "@/lib/pdf/kit";

/*
 * Playlist pour le DJ (A4 portrait, texte sélectionnable) : les morceaux
 * validés moment par moment, numérotés, avec leur durée, puis la liste
 * « à ne pas passer ». Textes déjà traduits par la route.
 */

export type PlaylistPdfData = {
  documentTitle: string;
  eyebrow: string;
  title: string;
  subtitle: string | null;
  summary: string;
  empty: string;
  footer: string;
  page: (current: number, total: number) => string;
  groups: {
    label: string;
    /** « À ne pas passer » : titre en terracotta, avec une consigne. */
    avoid: boolean;
    note: string | null;
    tracks: { name: string; artist: string; duration: string | null }[];
  }[];
};

const MARGIN = { x: 56, top: 64, bottom: 64 };
const WIDTH = A4.width - 2 * MARGIN.x;
const NUMBER_WIDTH = 22;
const DURATION_WIDTH = 40;
const TEXT_X = MARGIN.x + NUMBER_WIDTH;
const TEXT_WIDTH = WIDTH - NUMBER_WIDTH - DURATION_WIDTH - 8;
const ROW_HEIGHT = 30;

const text = (page: PDFPage, value: string, x: number, y: number, font: PDFFont, size: number, color: RGB = COLOR.charcoal) =>
  page.drawText(value, { x, y, font, size, color });

export async function buildPlaylistPdf(data: PlaylistPdfData): Promise<Uint8Array> {
  const { pdf, fonts } = await createDocument(data.documentTitle);
  let page = pdf.addPage([A4.width, A4.height]);
  let y = A4.height - MARGIN.top;
  const ensure = (height: number) => {
    if (y - height >= MARGIN.bottom) return;
    page = pdf.addPage([A4.width, A4.height]);
    y = A4.height - MARGIN.top;
  };

  // En-tête.
  text(page, data.eyebrow.toLocaleUpperCase(), MARGIN.x, y, fonts.body, 9.5, COLOR.terracotta);
  y -= 34;
  for (const line of wrap(data.title, fonts.title, 28, WIDTH)) {
    text(page, line, MARGIN.x, y, fonts.title, 28);
    y -= 34;
  }
  if (data.subtitle) {
    text(page, data.subtitle, MARGIN.x, y + 8, fonts.italic, 14, COLOR.stone);
    y -= 18;
  }
  text(page, fit(data.summary, fonts.body, 12, WIDTH), MARGIN.x, y, fonts.body, 12, COLOR.stone);
  y -= 28;

  if (data.groups.length === 0) {
    text(page, data.empty, MARGIN.x, y, fonts.italic, 12, COLOR.stone);
  }

  for (const group of data.groups) {
    // Un titre de moment n'est jamais seul en bas de page.
    ensure(40 + (group.note ? 16 : 0) + ROW_HEIGHT);
    y -= 8;
    text(page, group.label, MARGIN.x, y, fonts.title, 16, group.avoid ? COLOR.terracotta : COLOR.charcoal);
    y -= 10;
    page.drawLine({ start: { x: MARGIN.x, y }, end: { x: A4.width - MARGIN.x, y }, thickness: 0.6, color: COLOR.sand });
    y -= 18;
    if (group.note) {
      text(page, fit(group.note, fonts.italic, 10.5, WIDTH), MARGIN.x, y, fonts.italic, 10.5, COLOR.terracotta);
      y -= 18;
    }

    group.tracks.forEach((track, index) => {
      ensure(ROW_HEIGHT);
      const number = group.avoid ? "×" : String(index + 1);
      text(page, number, MARGIN.x, y, fonts.body, 10.5, group.avoid ? COLOR.terracotta : COLOR.stone);
      text(page, fit(track.name, fonts.body, 12, TEXT_WIDTH), TEXT_X, y, fonts.body, 12);
      text(page, fit(track.artist, fonts.italic, 10, TEXT_WIDTH), TEXT_X, y - 12, fonts.italic, 10, COLOR.stone);
      if (track.duration) {
        const width = fonts.body.widthOfTextAtSize(track.duration, 10.5);
        text(page, track.duration, A4.width - MARGIN.x - width, y, fonts.body, 10.5, COLOR.stone);
      }
      y -= ROW_HEIGHT;
    });
    y -= 6;
  }

  // Pied de page, une fois le document complet.
  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    text(current, fit(data.footer, fonts.italic, 9.5, WIDTH / 2), MARGIN.x, 24, fonts.italic, 9.5, COLOR.stone);
    const number = data.page(index + 1, pages.length);
    text(current, number, A4.width - MARGIN.x - fonts.body.widthOfTextAtSize(number, 9.5), 24, fonts.body, 9.5, COLOR.stone);
  });

  return pdf.save();
}

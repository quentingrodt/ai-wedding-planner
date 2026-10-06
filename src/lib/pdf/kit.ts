import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type RGB } from "pdf-lib";

/*
 * Outils communs des exports PDF (plan de table, rétroplanning, calendrier) :
 * palette, polices embarquées (assets/fonts, tous les accents passent) et
 * mise en forme du texte.
 */

export const A4 = { width: 595.28, height: 841.89 };

const hex = (value: string): RGB =>
  rgb(
    parseInt(value.slice(1, 3), 16) / 255,
    parseInt(value.slice(3, 5), 16) / 255,
    parseInt(value.slice(5, 7), 16) / 255,
  );

export const COLOR = {
  charcoal: hex("#2b2a28"),
  stone: hex("#6b665f"),
  terracotta: hex("#a9533a"),
  terracottaSoft: hex("#f3e4dd"),
  sage: hex("#8a9a82"),
  sageDeep: hex("#4a5842"),
  sand: hex("#e3d5c1"),
  linen: hex("#efe9e1"),
  ivory: hex("#faf7f2"),
};

export type Fonts = { title: PDFFont; body: PDFFont; italic: PDFFont };

const fontFile = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));

/** Document prêt à écrire : métadonnées et polices Playfair / Crimson embarquées. */
export async function createDocument(title: string): Promise<{ pdf: PDFDocument; fonts: Fonts }> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(title);
  pdf.setCreator("Céleste");

  const [titleFont, body, italic] = await Promise.all([
    fontFile("PlayfairDisplay-Regular.ttf"),
    fontFile("CrimsonText-Regular.ttf"),
    fontFile("CrimsonText-Italic.ttf"),
  ]);
  return {
    pdf,
    fonts: {
      title: await pdf.embedFont(titleFont, { subset: true }),
      body: await pdf.embedFont(body, { subset: true }),
      italic: await pdf.embedFont(italic, { subset: true }),
    },
  };
}

/** Coupe un texte en lignes tenant dans width. */
export function wrap(text: string, f: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (f.widthOfTextAtSize(candidate, size) <= width || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.map((value) => fit(value, f, size, width));
}

/** Tronque avec « … » ce qui dépasse width. */
export function fit(text: string, f: PDFFont, size: number, width: number): string {
  if (f.widthOfTextAtSize(text, size) <= width) return text;
  let end = text.length;
  while (end > 1 && f.widthOfTextAtSize(`${text.slice(0, end)}…`, size) > width) end--;
  return `${text.slice(0, end)}…`;
}

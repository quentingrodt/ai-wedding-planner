import { PDFDocument, rgb } from "pdf-lib";

/*
 * Fichier d'impression : image 300 dpi du faire-part (fond perdu inclus)
 * posée sur une page plus grande, avec traits de coupe, TrimBox et BleedBox
 * pour les logiciels des imprimeurs.
 */

/** Formats de coupe (portrait), en millimètres. */
export const PRINT_FORMATS = {
  a5: { width: 148, height: 210 },
  a6: { width: 105, height: 148 },
} as const;
export type PrintFormat = keyof typeof PRINT_FORMATS;

export const PRINT_DPI = 300;
/** Fond perdu : le fond déborde de 3 mm au-delà de la coupe. */
export const BLEED_MM = 3;
/** Marge extérieure qui accueille les traits de coupe. */
const MARKS_MARGIN_MM = 9;
/** Traits de coupe : départ à 1 mm du fond perdu, 4 mm de long. */
const MARK_GAP_MM = 1;
const MARK_LENGTH_MM = 4;

const MM_PER_INCH = 25.4;
export const mmToPx = (mm: number) => Math.round((mm / MM_PER_INCH) * PRINT_DPI);
const mmToPt = (mm: number) => (mm / MM_PER_INCH) * 72;

/** Dimensions en pixels de l'image à produire : coupe + fond perdu. */
export function bleedSizePx(format: PrintFormat) {
  const { width, height } = PRINT_FORMATS[format];
  return {
    width: mmToPx(width + 2 * BLEED_MM),
    height: mmToPx(height + 2 * BLEED_MM),
    trimWidth: mmToPx(width),
    trimHeight: mmToPx(height),
    bleed: mmToPx(BLEED_MM),
  };
}

/** Assemble le PDF d'impression à partir de l'image (fond perdu inclus). */
export async function buildPrintPdf({
  png,
  format,
  title,
}: {
  png: ArrayBuffer;
  format: PrintFormat;
  title: string;
}): Promise<Uint8Array> {
  const { width, height } = PRINT_FORMATS[format];
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator("Céleste");

  const margin = mmToPt(MARKS_MARGIN_MM);
  const bleed = mmToPt(BLEED_MM);
  const trimW = mmToPt(width);
  const trimH = mmToPt(height);
  const page = pdf.addPage([trimW + 2 * (bleed + margin), trimH + 2 * (bleed + margin)]);

  // Zones normalisées : coupe (TrimBox) et fond perdu (BleedBox).
  const trimX = margin + bleed;
  const trimY = margin + bleed;
  page.setTrimBox(trimX, trimY, trimW, trimH);
  page.setBleedBox(margin, margin, trimW + 2 * bleed, trimH + 2 * bleed);

  const image = await pdf.embedPng(png);
  page.drawImage(image, {
    x: margin,
    y: margin,
    width: trimW + 2 * bleed,
    height: trimH + 2 * bleed,
  });

  // Traits de coupe aux quatre coins, dans le prolongement des bords de coupe.
  const start = bleed + mmToPt(MARK_GAP_MM);
  const length = mmToPt(MARK_LENGTH_MM);
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 0.25,
      color: rgb(0, 0, 0),
    });
  for (const x of [trimX, trimX + trimW]) {
    for (const y of [trimY, trimY + trimH]) {
      const sx = x === trimX ? -1 : 1;
      const sy = y === trimY ? -1 : 1;
      // Trait vertical (prolonge le bord gauche/droit) et horizontal (haut/bas).
      line(x, y + sy * start, x, y + sy * (start + length));
      line(x + sx * start, y, x + sx * (start + length), y);
    }
  }

  return pdf.save();
}

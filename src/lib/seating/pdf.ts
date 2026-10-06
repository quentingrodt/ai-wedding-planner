import type { PDFDocument, PDFFont, PDFPage, RGB } from "pdf-lib";
import { A4, COLOR, createDocument, fit, wrap, type Fonts } from "@/lib/pdf/kit";
import type { ListingGuest, SeatingListing } from "./listing";

/*
 * Export PDF du plan de table (A4 portrait, texte sélectionnable) :
 * 1. les tables et leurs invités, deux colonnes ;
 * 2. l'index alphabétique (accueil des invités, plan d'entrée) ;
 * 3. le récapitulatif pour le traiteur (enfants, régimes par table).
 * Polices embarquées (assets/fonts) : tous les accents des prénoms passent.
 */

export type SeatingPdfLabels = {
  documentTitle: string;
  eyebrow: string;
  title: string;
  /** Date du mariage, déjà formatée. */
  subtitle: string | null;
  summary: string;
  tablesTitle: string;
  seats: (seated: number, capacity: number) => string;
  emptyTable: string;
  child: string;
  noTables: string;
  unseatedTitle: string;
  indexTitle: string;
  toSeat: string;
  catererTitle: string;
  columns: { table: string; guests: string; adults: string; children: string; diets: string };
  total: string;
  dietsTitle: string;
  noDiets: string;
  footer: string;
  page: (current: number, total: number) => string;
};

const MARGIN = { x: 56, top: 64, bottom: 72 };
const CONTENT_WIDTH = A4.width - 2 * MARGIN.x;
const GUTTER = 28;
const COLUMN_WIDTH = (CONTENT_WIDTH - GUTTER) / 2;

/** Curseur de mise en page : ajoute les pages au besoin. */
class Layout {
  page!: PDFPage;
  y = 0;
  constructor(
    readonly pdf: PDFDocument,
    readonly fonts: Fonts,
  ) {
    this.newPage();
  }

  newPage() {
    this.page = this.pdf.addPage([A4.width, A4.height]);
    this.y = A4.height - MARGIN.top;
  }

  /** Garantit height points de place ; sinon passe à la page suivante. */
  ensure(height: number) {
    if (this.y - height < MARGIN.bottom) this.newPage();
  }

  text(
    value: string,
    x: number,
    y: number,
    options: { font?: PDFFont; size?: number; color?: RGB } = {},
  ) {
    this.page.drawText(value, {
      x,
      y,
      font: options.font ?? this.fonts.body,
      size: options.size ?? 11.5,
      color: options.color ?? COLOR.charcoal,
    });
  }

  rule(y: number, color = COLOR.sand) {
    this.page.drawLine({
      start: { x: MARGIN.x, y },
      end: { x: A4.width - MARGIN.x, y },
      thickness: 0.6,
      color,
    });
  }

  /** Titre de section (Playfair) suivi d'un filet. */
  section(title: string) {
    this.ensure(70);
    this.text(title, MARGIN.x, this.y - 22, { font: this.fonts.title, size: 18 });
    this.y -= 34;
    this.rule(this.y);
    this.y -= 22;
  }
}

/** Lignes d'un invité dans un bloc de table : nom, puis régime éventuel. */
function guestLines(guest: ListingGuest, fonts: Fonts, width: number) {
  const diet = guest.diet ? wrap(guest.diet, fonts.italic, 10.5, width - 14) : [];
  return { diet, height: 16 + diet.length * 13 };
}

function drawTableBlock(
  layout: Layout,
  table: SeatingListing["tables"][number],
  x: number,
  top: number,
  labels: SeatingPdfLabels,
) {
  const { fonts } = layout;
  const full = table.guests.length >= table.capacity;
  const seats = labels.seats(table.guests.length, table.capacity);
  const seatsWidth = fonts.body.widthOfTextAtSize(seats, 10.5);

  layout.text(fit(table.name, fonts.title, 13.5, COLUMN_WIDTH - seatsWidth - 10), x, top - 14, {
    font: fonts.title,
    size: 13.5,
  });
  layout.text(seats, x + COLUMN_WIDTH - seatsWidth, top - 13, {
    size: 10.5,
    color: full ? COLOR.terracotta : COLOR.stone,
  });
  let y = top - 24;
  layout.page.drawLine({
    start: { x, y },
    end: { x: x + COLUMN_WIDTH, y },
    thickness: 0.6,
    color: full ? COLOR.terracotta : COLOR.sage,
  });
  y -= 16;

  if (table.guests.length === 0) {
    layout.text(labels.emptyTable, x, y, { font: fonts.italic, size: 11, color: COLOR.stone });
    return;
  }

  table.guests.forEach((guest, index) => {
    const number = `${index + 1}.`;
    layout.text(number, x + 12 - fonts.body.widthOfTextAtSize(number, 10.5), y, {
      size: 10.5,
      color: COLOR.stone,
    });
    const childTag = guest.isChild ? `  ${labels.child}` : "";
    const nameWidth =
      COLUMN_WIDTH - 18 - (childTag ? fonts.italic.widthOfTextAtSize(childTag, 10.5) : 0);
    const name = fit(guest.displayName, fonts.body, 11.5, nameWidth);
    layout.text(name, x + 18, y);
    if (childTag) {
      layout.text(childTag, x + 18 + fonts.body.widthOfTextAtSize(name, 11.5), y, {
        font: fonts.italic,
        size: 10.5,
        color: COLOR.stone,
      });
    }
    y -= 13;
    for (const line of guestLines(guest, fonts, COLUMN_WIDTH - 18).diet) {
      layout.text(line, x + 32, y, { font: fonts.italic, size: 10.5, color: COLOR.terracotta });
      y -= 13;
    }
    y -= 3;
  });
}

/** Table plus haute qu'une page : en-tête puis invités sur deux colonnes, sur plusieurs pages. */
function drawLongTable(
  layout: Layout,
  table: SeatingListing["tables"][number],
  labels: SeatingPdfLabels,
) {
  const { fonts } = layout;
  layout.ensure(60);
  const seats = labels.seats(table.guests.length, table.capacity);
  layout.text(fit(table.name, fonts.title, 13.5, CONTENT_WIDTH - 120), MARGIN.x, layout.y - 14, {
    font: fonts.title,
    size: 13.5,
  });
  layout.text(
    seats,
    A4.width - MARGIN.x - fonts.body.widthOfTextAtSize(seats, 10.5),
    layout.y - 13,
    {
      size: 10.5,
      color: COLOR.stone,
    },
  );
  layout.y -= 24;
  layout.rule(layout.y, COLOR.sage);
  layout.y -= 16;
  drawTwoColumnList(layout, table.guests, 16, (guest, left, y, index) => {
    const suffix = [guest.isChild ? labels.child : null, guest.diet].filter(Boolean).join(" · ");
    const number = `${index + 1}.`;
    layout.text(number, left + 12 - fonts.body.widthOfTextAtSize(number, 10.5), y, {
      size: 10.5,
      color: COLOR.stone,
    });
    const x = left + 18;
    const name = fit(guest.displayName, fonts.body, 11.5, COLUMN_WIDTH * 0.55);
    layout.text(name, x, y);
    if (suffix) {
      const nameWidth = fonts.body.widthOfTextAtSize(name, 11.5);
      layout.text(
        fit(`  ${suffix}`, fonts.italic, 10.5, COLUMN_WIDTH - 18 - nameWidth),
        x + nameWidth,
        y,
        {
          font: fonts.italic,
          size: 10.5,
          color: guest.diet ? COLOR.terracotta : COLOR.stone,
        },
      );
    }
  });
  layout.y -= 12;
}

const tableBlockHeight = (table: SeatingListing["tables"][number], fonts: Fonts) =>
  40 +
  (table.guests.length === 0
    ? 14
    : table.guests.reduce(
        (sum, guest) => sum + guestLines(guest, fonts, COLUMN_WIDTH - 18).height,
        0,
      )) +
  18;

/** Liste sur deux colonnes, remplies l'une après l'autre, page par page. */
function drawTwoColumnList<T>(
  layout: Layout,
  items: readonly T[],
  lineHeight: number,
  draw: (item: T, x: number, y: number, index: number) => void,
) {
  let index = 0;
  while (index < items.length) {
    layout.ensure(lineHeight * 3);
    const rows = Math.max(1, Math.floor((layout.y - MARGIN.bottom) / lineHeight));
    const pageItems = items.slice(index, index + rows * 2);
    const perColumn = Math.ceil(pageItems.length / 2);
    pageItems.forEach((item, position) => {
      const column = position < perColumn ? 0 : 1;
      const row = column === 0 ? position : position - perColumn;
      draw(
        item,
        MARGIN.x + column * (COLUMN_WIDTH + GUTTER),
        layout.y - row * lineHeight,
        index + position,
      );
    });
    index += pageItems.length;
    layout.y -= perColumn * lineHeight + 8;
    if (index < items.length) layout.newPage();
  }
}

/** Ligne « Dupont, Marie ........ Table d'Honneur ». */
function drawIndexEntry(
  layout: Layout,
  entry: SeatingListing["index"][number],
  x: number,
  y: number,
  labels: SeatingPdfLabels,
) {
  const { fonts } = layout;
  const target = entry.tableName ?? labels.toSeat;
  const targetFont = entry.tableName ? fonts.body : fonts.italic;
  const targetText = fit(target, targetFont, 10.5, COLUMN_WIDTH * 0.45);
  const targetWidth = targetFont.widthOfTextAtSize(targetText, 10.5);
  const name = fit(entry.indexName, fonts.body, 11, COLUMN_WIDTH - targetWidth - 18);
  const nameWidth = fonts.body.widthOfTextAtSize(name, 11);

  layout.text(name, x, y, { size: 11 });
  const dotWidth = fonts.body.widthOfTextAtSize(".", 9);
  const space = COLUMN_WIDTH - nameWidth - targetWidth - 12;
  if (space > dotWidth * 2) {
    layout.text(".".repeat(Math.floor(space / dotWidth)), x + nameWidth + 6, y, {
      size: 9,
      color: COLOR.sand,
    });
  }
  layout.text(targetText, x + COLUMN_WIDTH - targetWidth, y, {
    font: targetFont,
    size: 10.5,
    color: entry.tableName ? COLOR.stone : COLOR.terracotta,
  });
}

/** Tableau du traiteur : une ligne par table, puis le total. */
function drawCatererTable(layout: Layout, listing: SeatingListing, labels: SeatingPdfLabels) {
  const { fonts } = layout;
  const columns = [
    { label: labels.columns.table, width: CONTENT_WIDTH - 4 * 78, align: "left" as const },
    { label: labels.columns.guests, width: 78, align: "right" as const },
    { label: labels.columns.adults, width: 78, align: "right" as const },
    { label: labels.columns.children, width: 78, align: "right" as const },
    { label: labels.columns.diets, width: 78, align: "right" as const },
  ];
  const row = (cells: string[], y: number, options: { font?: PDFFont; color?: RGB } = {}) => {
    let x = MARGIN.x;
    cells.forEach((cell, i) => {
      const column = columns[i];
      const f = options.font ?? fonts.body;
      const value = fit(cell, f, 11, column.width - 8);
      const width = f.widthOfTextAtSize(value, 11);
      layout.text(value, column.align === "left" ? x : x + column.width - width, y, {
        font: f,
        size: 11,
        color: options.color,
      });
      x += column.width;
    });
  };

  layout.ensure(60);
  row(
    columns.map((column) => column.label),
    layout.y,
    { font: fonts.italic, color: COLOR.stone },
  );
  layout.y -= 8;
  layout.rule(layout.y);
  layout.y -= 16;

  for (const table of listing.tables) {
    layout.ensure(20);
    const guests = table.guests.length;
    row(
      [
        table.name,
        String(guests),
        String(guests - table.children),
        String(table.children),
        String(table.diets),
      ],
      layout.y,
    );
    layout.y -= 18;
  }
  const { seated } = listing.totals;
  const seatedChildren = listing.tables.reduce((sum, table) => sum + table.children, 0);
  const seatedDiets = listing.tables.reduce((sum, table) => sum + table.diets, 0);
  layout.ensure(30);
  layout.rule(layout.y + 8, COLOR.sage);
  layout.y -= 6;
  row(
    [
      labels.total,
      String(seated),
      String(seated - seatedChildren),
      String(seatedChildren),
      String(seatedDiets),
    ],
    layout.y,
    { font: fonts.title },
  );
  layout.y -= 30;
}

export async function buildSeatingPdf(
  listing: SeatingListing,
  labels: SeatingPdfLabels,
): Promise<Uint8Array> {
  const { pdf, fonts } = await createDocument(labels.documentTitle);
  const layout = new Layout(pdf, fonts);

  // En-tête du document.
  layout.text(labels.eyebrow.toLocaleUpperCase(), MARGIN.x, layout.y, {
    size: 9.5,
    color: COLOR.terracotta,
  });
  layout.y -= 34;
  for (const line of wrap(labels.title, fonts.title, 28, CONTENT_WIDTH)) {
    layout.text(line, MARGIN.x, layout.y, { font: fonts.title, size: 28 });
    layout.y -= 34;
  }
  if (labels.subtitle) {
    layout.text(labels.subtitle, MARGIN.x, layout.y + 8, {
      font: fonts.italic,
      size: 14,
      color: COLOR.stone,
    });
    layout.y -= 18;
  }
  for (const line of wrap(labels.summary, fonts.body, 12, CONTENT_WIDTH)) {
    layout.text(line, MARGIN.x, layout.y, { size: 12, color: COLOR.stone });
    layout.y -= 16;
  }
  layout.y -= 14;

  // 1. Les tables, deux par rangée ; une rangée n'est jamais coupée.
  layout.section(labels.tablesTitle);
  if (listing.tables.length === 0) {
    layout.text(labels.noTables, MARGIN.x, layout.y, { font: fonts.italic, color: COLOR.stone });
    layout.y -= 24;
  }
  const pageHeight = A4.height - MARGIN.top - MARGIN.bottom;
  for (let i = 0; i < listing.tables.length; i += 2) {
    const pair = listing.tables.slice(i, i + 2);
    const height = Math.max(...pair.map((table) => tableBlockHeight(table, fonts)));
    // Très grande tablée : plus haute qu'une page, elle s'étale sur toute la largeur.
    if (height > pageHeight) {
      for (const table of pair) {
        const tableHeight = tableBlockHeight(table, fonts);
        if (tableHeight > pageHeight) {
          drawLongTable(layout, table, labels);
        } else {
          layout.ensure(tableHeight);
          drawTableBlock(layout, table, MARGIN.x, layout.y, labels);
          layout.y -= tableHeight;
        }
      }
      continue;
    }
    layout.ensure(height);
    pair.forEach((table, column) =>
      drawTableBlock(layout, table, MARGIN.x + column * (COLUMN_WIDTH + GUTTER), layout.y, labels),
    );
    layout.y -= height;
  }

  // Invités confirmés sans table.
  if (listing.unseated.length > 0) {
    layout.section(labels.unseatedTitle);
    drawTwoColumnList(layout, listing.unseated, 16, (guest, x, y) => {
      const childTag = guest.isChild ? `  ${labels.child}` : "";
      const name = fit(guest.displayName, fonts.body, 11.5, COLUMN_WIDTH - 50);
      layout.text(name, x, y);
      if (childTag) {
        layout.text(childTag, x + fonts.body.widthOfTextAtSize(name, 11.5), y, {
          font: fonts.italic,
          size: 10.5,
          color: COLOR.stone,
        });
      }
    });
    layout.y -= 10;
  }

  // 2. Index alphabétique, sur une nouvelle page.
  if (listing.index.length > 0) {
    layout.newPage();
    layout.section(labels.indexTitle);
    drawTwoColumnList(layout, listing.index, 16, (entry, x, y) =>
      drawIndexEntry(layout, entry, x, y, labels),
    );
  }

  // 3. Récapitulatif traiteur.
  layout.newPage();
  layout.section(labels.catererTitle);
  drawCatererTable(layout, listing, labels);

  layout.ensure(60);
  layout.text(labels.dietsTitle, MARGIN.x, layout.y, { font: fonts.title, size: 13.5 });
  layout.y -= 22;
  const withDiet = listing.tables.flatMap((table) =>
    table.guests.filter((guest) => guest.diet).map((guest) => ({ table: table.name, guest })),
  );
  if (withDiet.length === 0) {
    layout.text(labels.noDiets, MARGIN.x, layout.y, { font: fonts.italic, color: COLOR.stone });
  }
  for (const { table, guest } of withDiet) {
    const diet = wrap(guest.diet ?? "", fonts.italic, 11, CONTENT_WIDTH - 230);
    layout.ensure(16 + (diet.length - 1) * 13);
    layout.text(fit(table, fonts.body, 11, 100), MARGIN.x, layout.y, {
      size: 11,
      color: COLOR.stone,
    });
    layout.text(fit(guest.displayName, fonts.body, 11.5, 110), MARGIN.x + 110, layout.y);
    diet.forEach((line, i) =>
      layout.text(line, MARGIN.x + 230, layout.y - i * 13, {
        font: fonts.italic,
        size: 11,
        color: COLOR.terracotta,
      }),
    );
    layout.y -= 16 + (diet.length - 1) * 13;
  }

  // Pied de page : document et pagination.
  const pages = pdf.getPages();
  pages.forEach((page, i) => {
    const footerY = MARGIN.bottom - 34;
    page.drawLine({
      start: { x: MARGIN.x, y: footerY + 14 },
      end: { x: A4.width - MARGIN.x, y: footerY + 14 },
      thickness: 0.5,
      color: COLOR.sand,
    });
    page.drawText(fit(labels.footer, fonts.italic, 9.5, CONTENT_WIDTH - 80), {
      x: MARGIN.x,
      y: footerY,
      font: fonts.italic,
      size: 9.5,
      color: COLOR.stone,
    });
    const number = labels.page(i + 1, pages.length);
    page.drawText(number, {
      x: A4.width - MARGIN.x - fonts.body.widthOfTextAtSize(number, 9.5),
      y: footerY,
      font: fonts.body,
      size: 9.5,
      color: COLOR.stone,
    });
  });

  return pdf.save();
}

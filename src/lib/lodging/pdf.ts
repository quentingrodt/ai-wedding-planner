import type { PDFDocument, PDFFont, PDFPage, RGB } from "pdf-lib";
import { A4, COLOR, createDocument, fit, wrap, type Fonts } from "@/lib/pdf/kit";
import type { ListingHousehold, ListingLodging, LodgingListing } from "./listing";

/*
 * Export PDF de la répartition des hébergements (A4 portrait, texte
 * sélectionnable) :
 * 1. chaque hébergement, toutes ses informations, puis qui y dort, par foyer ;
 * 2. les invités venant de loin encore sans hébergement ;
 * 3. l'index alphabétique « qui dort où ».
 * Polices embarquées (assets/fonts) : tous les accents passent.
 */

export type LodgingPdfLabels = {
  documentTitle: string;
  eyebrow: string;
  title: string;
  /** Date du mariage, déjà formatée. */
  subtitle: string | null;
  summary: string;
  lodgingsTitle: string;
  noLodgings: string;
  /** « Hôtel · Confirmé » : type et avancement. */
  kindStatus: (lodging: ListingLodging["lodging"]) => string;
  occupancy: (people: number, rooms: number, planned: number | null) => string;
  facts: {
    travel: (minutes: number) => string;
    perNight: (price: number) => string;
    rooms: (count: number) => string;
    groupRate: string;
    code: string;
    deadline: string;
    contact: string;
    url: string;
    notes: string;
  };
  /** Date ISO, formatée. */
  date: (iso: string) => string;
  residentsTitle: string;
  nobody: string;
  child: string;
  unassignedTitle: string;
  unassignedLead: string;
  indexTitle: string;
  toHost: string;
  footer: string;
  page: (current: number, total: number) => string;
};

const MARGIN = { x: 56, top: 64, bottom: 72 };
const CONTENT_WIDTH = A4.width - 2 * MARGIN.x;
const GUTTER = 28;
const COLUMN_WIDTH = (CONTENT_WIDTH - GUTTER) / 2;
const LABEL_WIDTH = 118;

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

  text(value: string, x: number, y: number, options: { font?: PDFFont; size?: number; color?: RGB } = {}) {
    this.page.drawText(value, {
      x,
      y,
      font: options.font ?? this.fonts.body,
      size: options.size ?? 11.5,
      color: options.color ?? COLOR.charcoal,
    });
  }

  rule(y: number, color = COLOR.sand, from = MARGIN.x, to = A4.width - MARGIN.x) {
    this.page.drawLine({ start: { x: from, y }, end: { x: to, y }, thickness: 0.6, color });
  }

  /** Titre de section (Playfair) suivi d'un filet. */
  section(title: string) {
    this.ensure(90);
    this.text(title, MARGIN.x, this.y - 22, { font: this.fonts.title, size: 18 });
    this.y -= 34;
    this.rule(this.y);
    this.y -= 24;
  }

  /** Paragraphe coupé en lignes, page par page. */
  paragraph(value: string, x: number, width: number, options: { font?: PDFFont; size?: number; color?: RGB } = {}) {
    const size = options.size ?? 11;
    const leading = size + 3;
    for (const line of wrap(value, options.font ?? this.fonts.body, size, width)) {
      this.ensure(leading);
      this.text(line, x, this.y, { ...options, size });
      this.y -= leading;
    }
  }
}

/** Ligne « Libellé   valeur » d'une fiche ; la valeur peut tenir sur plusieurs lignes. */
function infoRow(layout: Layout, label: string, value: string) {
  const { fonts } = layout;
  const lines = wrap(value, fonts.body, 11, CONTENT_WIDTH - LABEL_WIDTH);
  layout.ensure(14 * lines.length + 2);
  layout.text(fit(label, fonts.italic, 10.5, LABEL_WIDTH - 10), MARGIN.x, layout.y, {
    font: fonts.italic,
    size: 10.5,
    color: COLOR.stone,
  });
  lines.forEach((line, index) => layout.text(line, MARGIN.x + LABEL_WIDTH, layout.y - index * 14, { size: 11 }));
  layout.y -= 14 * lines.length + 2;
}

/** Les invités d'un foyer, à la suite : « Famille Martin   Marie Martin, Léa Martin (enfant) ». */
function householdRow(layout: Layout, household: ListingHousehold, labels: LodgingPdfLabels) {
  const { fonts } = layout;
  const names = household.guests
    .map((guest) => (guest.isChild ? `${guest.displayName} (${labels.child})` : guest.displayName))
    .join(", ");
  if (household.name === null) {
    layout.ensure(16);
    layout.text("·", MARGIN.x + 4, layout.y, { color: COLOR.sage });
    layout.text(fit(names, fonts.body, 11.5, CONTENT_WIDTH - 16), MARGIN.x + 16, layout.y);
    layout.y -= 16;
    return;
  }
  const lines = wrap(names, fonts.body, 11.5, CONTENT_WIDTH - LABEL_WIDTH);
  layout.ensure(15 * lines.length + 2);
  layout.text(fit(household.name, fonts.title, 11.5, LABEL_WIDTH - 10), MARGIN.x, layout.y, {
    font: fonts.title,
    size: 11.5,
  });
  lines.forEach((line, index) => layout.text(line, MARGIN.x + LABEL_WIDTH, layout.y - index * 15));
  layout.y -= 15 * lines.length + 2;
}

function drawLodging(layout: Layout, entry: ListingLodging, labels: LodgingPdfLabels) {
  const { fonts } = layout;
  const { lodging } = entry;
  // En-tête et premières lignes ensemble : un hébergement ne commence pas en bas de page.
  layout.ensure(110);

  const occupancy = labels.occupancy(entry.people, entry.rooms, lodging.kind === "family" ? null : lodging.rooms);
  const occupancyWidth = fonts.body.widthOfTextAtSize(occupancy, 10.5);
  const short = lodging.rooms !== null && lodging.kind !== "family" && entry.rooms > lodging.rooms;
  layout.text(fit(lodging.name, fonts.title, 15, CONTENT_WIDTH - occupancyWidth - 14), MARGIN.x, layout.y - 15, {
    font: fonts.title,
    size: 15,
  });
  layout.text(occupancy, A4.width - MARGIN.x - occupancyWidth, layout.y - 14, {
    size: 10.5,
    color: short ? COLOR.terracotta : COLOR.stone,
  });
  layout.y -= 32;
  const subtitle = [labels.kindStatus(lodging), lodging.location, lodging.travel_minutes !== null ? labels.facts.travel(lodging.travel_minutes) : null]
    .filter(Boolean)
    .join(" · ");
  layout.text(fit(subtitle, fonts.italic, 11, CONTENT_WIDTH), MARGIN.x, layout.y, {
    font: fonts.italic,
    size: 11,
    color: COLOR.stone,
  });
  layout.y -= 10;
  layout.rule(layout.y, COLOR.sage);
  layout.y -= 18;

  const priceLine = [
    lodging.price_per_night !== null ? labels.facts.perNight(lodging.price_per_night) : null,
    lodging.rooms !== null && lodging.kind !== "family" ? labels.facts.rooms(lodging.rooms) : null,
    lodging.group_rate ? labels.facts.groupRate : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (priceLine) {
    layout.ensure(16);
    layout.text(fit(priceLine, fonts.body, 11, CONTENT_WIDTH), MARGIN.x, layout.y, { size: 11 });
    layout.y -= 18;
  }
  if (lodging.booking_code) infoRow(layout, labels.facts.code, lodging.booking_code);
  if (lodging.deadline) infoRow(layout, labels.facts.deadline, labels.date(lodging.deadline));
  if (lodging.contact) infoRow(layout, labels.facts.contact, lodging.contact);
  if (lodging.url) infoRow(layout, labels.facts.url, lodging.url);
  if (lodging.notes) infoRow(layout, labels.facts.notes, lodging.notes);

  layout.y -= 6;
  layout.ensure(40);
  layout.text(labels.residentsTitle.toLocaleUpperCase(), MARGIN.x, layout.y, { size: 9, color: COLOR.terracotta });
  layout.y -= 16;
  if (entry.households.length === 0) {
    layout.text(labels.nobody, MARGIN.x, layout.y, { font: fonts.italic, size: 11, color: COLOR.stone });
    layout.y -= 16;
  }
  for (const household of entry.households) householdRow(layout, household, labels);
  layout.y -= 22;
}

/** Ligne « Dupont, Marie ........ Hôtel de la Poste » de l'index. */
function drawIndexEntry(
  layout: Layout,
  entry: LodgingListing["index"][number],
  x: number,
  y: number,
  labels: LodgingPdfLabels,
) {
  const { fonts } = layout;
  const target = entry.lodgingName ?? labels.toHost;
  const targetFont = entry.lodgingName ? fonts.body : fonts.italic;
  const targetText = fit(target, targetFont, 10.5, COLUMN_WIDTH * 0.5);
  const targetWidth = targetFont.widthOfTextAtSize(targetText, 10.5);
  const label = entry.isChild ? `${entry.indexName} (${labels.child})` : entry.indexName;
  const name = fit(label, fonts.body, 11, COLUMN_WIDTH - targetWidth - 18);
  const nameWidth = fonts.body.widthOfTextAtSize(name, 11);

  layout.text(name, x, y, { size: 11 });
  const dotWidth = fonts.body.widthOfTextAtSize(".", 9);
  const space = COLUMN_WIDTH - nameWidth - targetWidth - 12;
  if (space > dotWidth * 2) {
    layout.text(".".repeat(Math.floor(space / dotWidth)), x + nameWidth + 6, y, { size: 9, color: COLOR.sand });
  }
  layout.text(targetText, x + COLUMN_WIDTH - targetWidth, y, {
    font: targetFont,
    size: 10.5,
    color: entry.lodgingName ? COLOR.stone : COLOR.terracotta,
  });
}

/** Liste sur deux colonnes, remplies l'une après l'autre, page par page. */
function drawTwoColumnList<T>(
  layout: Layout,
  items: readonly T[],
  lineHeight: number,
  draw: (item: T, x: number, y: number) => void,
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
      draw(item, MARGIN.x + column * (COLUMN_WIDTH + GUTTER), layout.y - row * lineHeight);
    });
    index += pageItems.length;
    layout.y -= perColumn * lineHeight + 8;
    if (index < items.length) layout.newPage();
  }
}

export async function buildLodgingPdf(listing: LodgingListing, labels: LodgingPdfLabels): Promise<Uint8Array> {
  const { pdf, fonts } = await createDocument(labels.documentTitle);
  const layout = new Layout(pdf, fonts);

  // En-tête du document.
  layout.text(labels.eyebrow.toLocaleUpperCase(), MARGIN.x, layout.y, { size: 9.5, color: COLOR.terracotta });
  layout.y -= 34;
  for (const line of wrap(labels.title, fonts.title, 28, CONTENT_WIDTH)) {
    layout.text(line, MARGIN.x, layout.y, { font: fonts.title, size: 28 });
    layout.y -= 34;
  }
  if (labels.subtitle) {
    layout.text(labels.subtitle, MARGIN.x, layout.y + 8, { font: fonts.italic, size: 14, color: COLOR.stone });
    layout.y -= 18;
  }
  layout.paragraph(labels.summary, MARGIN.x, CONTENT_WIDTH, { size: 12, color: COLOR.stone });
  layout.y -= 14;

  // 1. Les hébergements.
  layout.section(labels.lodgingsTitle);
  if (listing.lodgings.length === 0) {
    layout.text(labels.noLodgings, MARGIN.x, layout.y, { font: fonts.italic, color: COLOR.stone });
    layout.y -= 24;
  }
  for (const entry of listing.lodgings) drawLodging(layout, entry, labels);

  // 2. Encore à loger.
  if (listing.unassigned.length > 0) {
    layout.section(labels.unassignedTitle);
    layout.paragraph(labels.unassignedLead, MARGIN.x, CONTENT_WIDTH, { font: fonts.italic, color: COLOR.stone });
    layout.y -= 6;
    for (const household of listing.unassigned) householdRow(layout, household, labels);
  }

  // 3. Index alphabétique, sur une nouvelle page.
  if (listing.index.length > 0) {
    layout.newPage();
    layout.section(labels.indexTitle);
    drawTwoColumnList(layout, listing.index, 16, (entry, x, y) => drawIndexEntry(layout, entry, x, y, labels));
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

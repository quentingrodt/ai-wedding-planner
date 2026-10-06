import type { PDFDocument, PDFFont, PDFPage, RGB } from "pdf-lib";
import { monthGrid, type MonthKey } from "@/lib/calendar/month";
import { A4, COLOR, createDocument, fit, wrap, type Fonts } from "@/lib/pdf/kit";

/*
 * Exports PDF du rétroplanning (texte sélectionnable, polices embarquées) :
 * - la liste des étapes, triée par échéance et groupée par mois (A4 portrait),
 *   avec des cases à cocher à la main ;
 * - le calendrier mois par mois (A4 paysage), une case par jour, du mois en
 *   cours au mois du mariage : les jours sans rendez-vous restent vierges.
 * Textes déjà traduits et dates déjà formatées par la route.
 */

type PageFooter = {
  footer: string;
  page: (current: number, total: number) => string;
};

/** Pied de page sur toutes les pages, une fois le document complet. */
function drawFooters(pdf: PDFDocument, fonts: Fonts, labels: PageFooter, marginX: number) {
  const pages = pdf.getPages();
  pages.forEach((page, index) => {
    const { width } = page.getSize();
    page.drawText(fit(labels.footer, fonts.italic, 9.5, width / 2), {
      x: marginX,
      y: 24,
      size: 9.5,
      font: fonts.italic,
      color: COLOR.stone,
    });
    const number = labels.page(index + 1, pages.length);
    page.drawText(number, {
      x: width - marginX - fonts.body.widthOfTextAtSize(number, 9.5),
      y: 24,
      size: 9.5,
      font: fonts.body,
      color: COLOR.stone,
    });
  });
}

const text = (
  page: PDFPage,
  value: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color: RGB = COLOR.charcoal,
) => page.drawText(value, { x, y, font, size, color });

// ————————————————————————————————————————————————————————————————
// Liste des étapes
// ————————————————————————————————————————————————————————————————

export type TasksPdfTask = {
  label: string;
  /** Échéance déjà formatée (« 12 nov. »), ou null. */
  due: string | null;
  /** Chapitre et rythme (« Prestataires · Serré »). */
  meta: string;
  done: boolean;
  urgent: boolean;
};

export type TasksPdfData = PageFooter & {
  documentTitle: string;
  eyebrow: string;
  title: string;
  subtitle: string | null;
  summary: string;
  empty: string;
  groups: { label: string; overdue: boolean; tasks: TasksPdfTask[] }[];
};

const LIST = { x: 56, top: 64, bottom: 64 };
const LIST_WIDTH = A4.width - 2 * LIST.x;
const DUE_WIDTH = 70;
const LABEL_X = LIST.x + 20;
const LABEL_WIDTH = LIST_WIDTH - 20 - DUE_WIDTH - 10;

export async function buildTasksPdf(data: TasksPdfData): Promise<Uint8Array> {
  const { pdf, fonts } = await createDocument(data.documentTitle);
  let page = pdf.addPage([A4.width, A4.height]);
  let y = A4.height - LIST.top;
  const ensure = (height: number) => {
    if (y - height >= LIST.bottom) return;
    page = pdf.addPage([A4.width, A4.height]);
    y = A4.height - LIST.top;
  };

  // En-tête.
  text(page, data.eyebrow.toLocaleUpperCase(), LIST.x, y, fonts.body, 9.5, COLOR.terracotta);
  y -= 34;
  for (const line of wrap(data.title, fonts.title, 28, LIST_WIDTH)) {
    text(page, line, LIST.x, y, fonts.title, 28);
    y -= 34;
  }
  if (data.subtitle) {
    text(page, data.subtitle, LIST.x, y + 8, fonts.italic, 14, COLOR.stone);
    y -= 18;
  }
  for (const line of wrap(data.summary, fonts.body, 12, LIST_WIDTH)) {
    text(page, line, LIST.x, y, fonts.body, 12, COLOR.stone);
    y -= 16;
  }
  y -= 12;

  if (data.groups.length === 0) {
    text(page, data.empty, LIST.x, y, fonts.italic, 12, COLOR.stone);
  }

  const taskHeight = (task: TasksPdfTask) =>
    wrap(task.label, fonts.body, 11.5, LABEL_WIDTH).length * 14 + 13 + 8;

  for (const group of data.groups) {
    // Un titre de mois n'est jamais seul en bas de page.
    ensure(44 + (group.tasks[0] ? taskHeight(group.tasks[0]) : 0));
    y -= 10;
    text(page, group.label, LIST.x, y, fonts.title, 16, group.overdue ? COLOR.terracotta : COLOR.charcoal);
    y -= 10;
    page.drawLine({
      start: { x: LIST.x, y },
      end: { x: A4.width - LIST.x, y },
      thickness: 0.6,
      color: COLOR.sand,
    });
    y -= 20;

    for (const task of group.tasks) {
      ensure(taskHeight(task));
      const ink = task.done ? COLOR.stone : COLOR.charcoal;

      // Case à cocher, cochée si l'étape est terminée.
      page.drawRectangle({
        x: LIST.x,
        y: y - 2,
        width: 10,
        height: 10,
        borderColor: task.done ? COLOR.sage : COLOR.stone,
        borderWidth: 0.8,
        color: task.done ? COLOR.sage : undefined,
      });
      if (task.done) {
        page.drawLine({ start: { x: LIST.x + 2.2, y: y + 3 }, end: { x: LIST.x + 4.4, y: y + 0.6 }, thickness: 1.2, color: COLOR.ivory });
        page.drawLine({ start: { x: LIST.x + 4.4, y: y + 0.6 }, end: { x: LIST.x + 8, y: y + 5.6 }, thickness: 1.2, color: COLOR.ivory });
      }

      if (task.due) {
        const dueColor = task.urgent && !task.done ? COLOR.terracotta : COLOR.stone;
        const due = fit(task.due, fonts.body, 10.5, DUE_WIDTH);
        text(page, due, A4.width - LIST.x - fonts.body.widthOfTextAtSize(due, 10.5), y, fonts.body, 10.5, dueColor);
      }
      for (const line of wrap(task.label, fonts.body, 11.5, LABEL_WIDTH)) {
        text(page, line, LABEL_X, y, fonts.body, 11.5, ink);
        if (task.done) {
          const width = fonts.body.widthOfTextAtSize(line, 11.5);
          page.drawLine({ start: { x: LABEL_X, y: y + 3.6 }, end: { x: LABEL_X + width, y: y + 3.6 }, thickness: 0.5, color: COLOR.stone });
        }
        y -= 14;
      }
      text(
        page,
        fit(task.meta, fonts.italic, 9.5, LABEL_WIDTH),
        LABEL_X,
        y + 1,
        fonts.italic,
        9.5,
        task.urgent && !task.done ? COLOR.terracotta : COLOR.stone,
      );
      y -= 21;
    }
  }

  drawFooters(pdf, fonts, data, LIST.x);
  return pdf.save();
}

// ————————————————————————————————————————————————————————————————
// Calendrier mois par mois
// ————————————————————————————————————————————————————————————————

export type CalendarPdfEntry = {
  text: string;
  tone: "event" | "task" | "done";
};

export type CalendarPdfData = PageFooter & {
  documentTitle: string;
  /** Prénoms du couple, en haut à droite de chaque page. */
  names: string;
  months: { key: MonthKey; label: string }[];
  /** En-têtes des colonnes, du lundi au dimanche. */
  weekdays: string[];
  /** Entrées par date ISO, déjà triées (rendez-vous, puis étapes). */
  entries: ReadonlyMap<string, CalendarPdfEntry[]>;
  weddingDate: string | null;
  weddingLabel: string;
  legend: { event: string; task: string };
  more: (count: number) => string;
};

const LANDSCAPE = { width: A4.height, height: A4.width };
const CAL = { x: 36, top: 40, bottom: 44 };
const CAL_WIDTH = LANDSCAPE.width - 2 * CAL.x;
const COLUMN = CAL_WIDTH / 7;
const HEADER_HEIGHT = 18;
const ENTRY_LINE = 9.5;

const TONE: Record<CalendarPdfEntry["tone"], RGB> = {
  event: COLOR.terracotta,
  task: COLOR.sageDeep,
  done: COLOR.sand,
};

export async function buildCalendarPdf(data: CalendarPdfData): Promise<Uint8Array> {
  const { pdf, fonts } = await createDocument(data.documentTitle);

  for (const month of data.months) {
    const page = pdf.addPage([LANDSCAPE.width, LANDSCAPE.height]);
    const top = LANDSCAPE.height - CAL.top;

    // Titre du mois et prénoms.
    text(page, month.label, CAL.x, top - 20, fonts.title, 22);
    const names = fit(data.names, fonts.italic, 12, CAL_WIDTH / 2);
    text(page, names, LANDSCAPE.width - CAL.x - fonts.italic.widthOfTextAtSize(names, 12), top - 16, fonts.italic, 12, COLOR.stone);

    // Légende, sous les prénoms.
    let legendX = LANDSCAPE.width - CAL.x;
    for (const [label, tone] of [
      [data.legend.task, "task"],
      [data.legend.event, "event"],
    ] as const) {
      const width = fonts.body.widthOfTextAtSize(label, 8.5);
      legendX -= width;
      text(page, label, legendX, top - 32, fonts.body, 8.5, COLOR.stone);
      page.drawCircle({ x: legendX - 6, y: top - 29, size: 2.2, color: TONE[tone] });
      legendX -= 18;
    }

    // En-têtes des jours.
    const gridTop = top - 44;
    data.weekdays.forEach((weekday, i) => {
      const label = weekday.toLocaleUpperCase();
      const width = fonts.body.widthOfTextAtSize(label, 8.5);
      text(page, label, CAL.x + i * COLUMN + (COLUMN - width) / 2, gridTop - 12, fonts.body, 8.5, COLOR.stone);
    });

    const weeks = monthGrid(month.key);
    const rowsTop = gridTop - HEADER_HEIGHT;
    const rowHeight = (rowsTop - CAL.bottom) / weeks.length;
    const maxLines = Math.max(1, Math.floor((rowHeight - 24) / ENTRY_LINE));

    weeks.forEach((week, row) => {
      week.forEach(({ date, inMonth }, column) => {
        const x = CAL.x + column * COLUMN;
        const cellTop = rowsTop - row * rowHeight;
        const isWedding = date === data.weddingDate && inMonth;

        page.drawRectangle({
          x,
          y: cellTop - rowHeight,
          width: COLUMN,
          height: rowHeight,
          borderColor: COLOR.sand,
          borderWidth: 0.5,
          color: !inMonth ? COLOR.linen : isWedding ? COLOR.terracottaSoft : undefined,
        });
        // Jours des mois voisins : case grisée, sans contenu.
        if (!inMonth) return;

        text(page, String(Number(date.slice(8))), x + 5, cellTop - 13, fonts.body, 10, isWedding ? COLOR.terracotta : COLOR.charcoal);
        if (isWedding) {
          const label = fit(data.weddingLabel, fonts.italic, 9, COLUMN - 26);
          text(page, label, x + COLUMN - 5 - fonts.italic.widthOfTextAtSize(label, 9), cellTop - 13, fonts.italic, 9, COLOR.terracotta);
        }

        // Chaque entrée tient sur deux lignes au plus ; au-delà de la case, « +N autres ».
        const entries = data.entries.get(date) ?? [];
        let lineY = cellTop - 26;
        let used = 0;
        let drawn = 0;
        for (const entry of entries) {
          const lines = wrap(entry.text, fonts.body, 7.5, COLUMN - 16);
          const kept =
            lines.length > 2 ? [lines[0], fit(`${lines[1]} ${lines.slice(2).join(" ")}`, fonts.body, 7.5, COLUMN - 16)] : lines;
          // Garde une ligne pour « +N autres » s'il reste des entrées après celle-ci.
          const reserve = drawn < entries.length - 1 ? 1 : 0;
          if (used + kept.length + reserve > maxLines) break;
          page.drawCircle({ x: x + 7, y: lineY + 2.6, size: 1.7, color: TONE[entry.tone] });
          for (const line of kept) {
            text(page, line, x + 12, lineY, fonts.body, 7.5, entry.tone === "done" ? COLOR.stone : COLOR.charcoal);
            lineY -= ENTRY_LINE;
          }
          used += kept.length;
          drawn += 1;
        }
        if (drawn < entries.length) {
          text(page, data.more(entries.length - drawn), x + 12, lineY, fonts.italic, 7.5, COLOR.stone);
        }
      });
    });
  }

  drawFooters(pdf, fonts, data, CAL.x);
  return pdf.save();
}

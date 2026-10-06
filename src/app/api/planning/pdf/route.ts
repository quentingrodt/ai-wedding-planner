import { hasLocale, type DateTimeFormatOptions } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { monthKeyOf, monthsBetween, WEEKDAY_SAMPLE } from "@/lib/calendar/month";
import { describePlanning } from "@/lib/planning/listing";
import {
  buildCalendarPdf,
  buildTasksPdf,
  type CalendarPdfEntry,
  type TasksPdfData,
} from "@/lib/planning/pdf";
import { isTaskTemplateKey } from "@/lib/tasks/schema";
import { daysBetween, isoDateToUtc, todayIsoDate } from "@/lib/weddings/dates";
import {
  getCalendarEvents,
  getCurrentUserId,
  getCurrentWedding,
  getPlanningSetup,
  getPlanningTasks,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

/** Au-delà, le calendrier s'arrête : un mariage très lointain n'imprime pas 3 ans de cases vides. */
const MAX_CALENDAR_MONTHS = 24;

/**
 * Rétroplanning en PDF, ouvert à tous les membres du mariage (lecture sous RLS) :
 * ?view=list : étapes triées par échéance, groupées par mois ;
 * ?view=calendar : calendrier mois par mois, du mois en cours au mois du mariage.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const requested = params.get("locale");
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const view = params.get("view") === "calendar" ? "calendar" : "list";

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const wedding = await getCurrentWedding(supabase);
  if (!wedding) {
    return new Response("Not found", { status: 404 });
  }

  const [rows, t, tPlanning, format] = await Promise.all([
    getPlanningTasks(supabase, wedding.id),
    getTranslations({ locale, namespace: "Planning.pdf" }),
    getTranslations({ locale, namespace: "Planning" }),
    getFormatter({ locale }),
  ]);
  const names = wedding.title;
  const today = todayIsoDate();
  const formatDate = (isoDate: string, options: DateTimeFormatOptions) =>
    format.dateTime(isoDateToUtc(isoDate), { ...options, timeZone: "UTC" });
  const taskLabel = (row: (typeof rows)[number]) =>
    isTaskTemplateKey(row.template_key) ? tPlanning(`tasks.${row.template_key}`) : row.title;
  const footer = {
    footer: t("footer", { names }),
    page: (current: number, total: number) => t("page", { current, total }),
  };

  let pdf: Uint8Array;
  if (view === "list") {
    const setup = await getPlanningSetup(supabase, wedding.id);
    const { entries, doneCount } = describePlanning({
      rows,
      answers: setup.answers,
      countryCode: setup.countryCode,
      weddingDate: wedding.wedding_date,
      today,
    });

    const groups: TasksPdfData["groups"] = [];
    for (const entry of entries) {
      const label =
        entry.groupKey === "overdue"
          ? tPlanning("groups.overdue")
          : entry.groupKey === "none"
            ? tPlanning("groups.none")
            : formatDate(entry.row.due_date!, { month: "long", year: "numeric" });
      let group = groups.at(-1);
      if (group?.label !== label) {
        group = { label: label.charAt(0).toLocaleUpperCase(locale) + label.slice(1), overdue: entry.groupKey === "overdue", tasks: [] };
        groups.push(group);
      }
      const meta = [
        entry.category ? tPlanning(`categories.${entry.category}`) : tPlanning("custom"),
        entry.pace ? tPlanning(`pace.${entry.pace}`) : null,
      ]
        .filter(Boolean)
        .join(" · ");
      group.tasks.push({
        label: taskLabel(entry.row),
        due: entry.row.due_date ? formatDate(entry.row.due_date, { day: "numeric", month: "short" }) : null,
        meta,
        done: entry.done,
        urgent: entry.pace === "urgent" || entry.overdue,
      });
    }

    const daysLeft = wedding.wedding_date ? daysBetween(today, wedding.wedding_date) : null;
    pdf = await buildTasksPdf({
      ...footer,
      documentTitle: t("listDocumentTitle", { names }),
      eyebrow: t("listEyebrow"),
      title: names,
      subtitle: wedding.wedding_date
        ? formatDate(wedding.wedding_date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
        : null,
      summary:
        daysLeft !== null && daysLeft >= 0
          ? t("summary", { days: daysLeft, done: doneCount, total: entries.length })
          : t("summaryNoCountdown", { done: doneCount, total: entries.length }),
      empty: tPlanning("empty"),
      groups,
    });
  } else {
    const events = await getCalendarEvents(supabase, wedding.id);
    const entries = new Map<string, CalendarPdfEntry[]>();
    const push = (date: string, entry: CalendarPdfEntry) => {
      const list = entries.get(date);
      if (list) list.push(entry);
      else entries.set(date, [entry]);
    };
    for (const event of events) {
      push(event.event_date, {
        text: event.start_time ? `${event.start_time} ${event.title}` : event.title,
        tone: "event",
      });
    }
    for (const row of rows) {
      if (row.due_date) push(row.due_date, { text: taskLabel(row), tone: row.status === "done" ? "done" : "task" });
    }

    const start = monthKeyOf(today);
    const weddingMonth = wedding.wedding_date ? monthKeyOf(wedding.wedding_date) : start;
    const end = weddingMonth > start ? weddingMonth : start;
    const months = monthsBetween(start, end)
      .slice(0, MAX_CALENDAR_MONTHS)
      .map((key) => {
        const label = formatDate(`${key}-01`, { month: "long", year: "numeric" });
        return { key, label: label.charAt(0).toLocaleUpperCase(locale) + label.slice(1) };
      });

    pdf = await buildCalendarPdf({
      ...footer,
      documentTitle: t("calendarDocumentTitle", { names }),
      names,
      months: months.length > 0 ? months : [{ key: start, label: start }],
      weekdays: WEEKDAY_SAMPLE.map((date) => formatDate(date, { weekday: "short" })),
      entries,
      weddingDate: wedding.wedding_date,
      weddingLabel: t("weddingLabel"),
      legend: { event: t("legend.event"), task: t("legend.task") },
      more: (count) => t("more", { count }),
    });
  }

  const fileName = view === "list" ? t("listFileName") : t("calendarFileName");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

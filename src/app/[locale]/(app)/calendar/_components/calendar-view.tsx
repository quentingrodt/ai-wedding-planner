"use client";

import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HeartIcon,
  MapPinIcon,
  PencilLineIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useFormatter, useTranslations, type DateTimeFormatOptions } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { deleteCalendarEvent } from "@/lib/calendar/actions";
import {
  addMonths,
  monthGrid,
  monthKeyOf,
  WEEKDAY_SAMPLE,
  type MonthKey,
} from "@/lib/calendar/month";
import type { CalendarEvent } from "@/lib/calendar/schema";
import { cn } from "@/lib/utils";
import { isoDateToUtc } from "@/lib/weddings/dates";
import { CalendarEventDialog } from "./calendar-event-dialog";

/** Échéance du rétroplanning, affichée dans le calendrier. */
export type CalendarTask = { id: string; label: string; date: string; done: boolean };

type CalendarViewProps = {
  events: CalendarEvent[];
  tasks: CalendarTask[];
  today: string;
  weddingDate: string | null;
};

type DayItems = { events: CalendarEvent[]; tasks: CalendarTask[] };

/** Nombre de rendez-vous à venir listés sous le calendrier. */
const UPCOMING_COUNT = 5;

/**
 * Calendrier mois par mois : une case par jour, avec les rendez-vous et les
 * échéances du rétroplanning. Un clic sur un jour ouvre son détail ; les
 * rendez-vous s'ajoutent, se modifient et se suppriment depuis le détail.
 */
export function CalendarView({ events, tasks, today, weddingDate }: CalendarViewProps) {
  const t = useTranslations("Calendar");
  const format = useFormatter();
  const [month, setMonth] = useState<MonthKey>(monthKeyOf(today));
  const [selected, setSelected] = useState(today);
  const [dialog, setDialog] = useState<{ open: boolean; event: CalendarEvent | null }>({
    open: false,
    event: null,
  });

  const byDate = new Map<string, DayItems>();
  const itemsOf = (date: string) => {
    let items = byDate.get(date);
    if (!items) byDate.set(date, (items = { events: [], tasks: [] }));
    return items;
  };
  for (const event of events) itemsOf(event.event_date).events.push(event);
  for (const task of tasks) itemsOf(task.date).tasks.push(task);

  const formatDate = (isoDate: string, options: DateTimeFormatOptions) =>
    format.dateTime(isoDateToUtc(isoDate), { ...options, timeZone: "UTC" });

  const selectDay = (date: string) => {
    setSelected(date);
    if (monthKeyOf(date) !== month) setMonth(monthKeyOf(date));
  };

  const selectedItems = byDate.get(selected) ?? { events: [], tasks: [] };
  const upcoming = events.filter((event) => event.event_date >= today).slice(0, UPCOMING_COUNT);

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="calendar-month" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="calendar-month" className="font-serif text-3xl first-letter:uppercase" aria-live="polite">
            {formatDate(`${month}-01`, { month: "long", year: "numeric" })}
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMonth(addMonths(month, -1))}
              aria-label={t("previous")}
              className="rounded-full"
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <button
              type="button"
              onClick={() => selectDay(today)}
              className="h-9 rounded-full px-4 text-sm text-stone ring-1 ring-border transition-colors hover:bg-linen"
            >
              {t("today")}
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMonth(addMonths(month, 1))}
              aria-label={t("next")}
              className="rounded-full"
            >
              <ChevronRightIcon aria-hidden />
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl bg-card ring-1 ring-border">
          <div className="grid grid-cols-7 border-b border-border bg-linen/60" aria-hidden>
            {WEEKDAY_SAMPLE.map((date) => (
              <span
                key={date}
                className="py-2 text-center text-xs tracking-wide text-stone uppercase"
              >
                {formatDate(date, { weekday: "short" })}
              </span>
            ))}
          </div>
          <div role="grid" aria-labelledby="calendar-month">
            {monthGrid(month).map((week) => (
              <div key={week[0].date} role="row" className="grid grid-cols-7">
                {week.map(({ date, inMonth }) => {
                  const items = byDate.get(date);
                  const count = (items?.events.length ?? 0) + (items?.tasks.length ?? 0);
                  const isWedding = date === weddingDate;
                  const isToday = date === today;
                  const isSelected = date === selected;
                  const chips = [
                    ...(items?.events.map((event) => ({
                      key: event.id,
                      label: event.title,
                      tone: "event" as const,
                    })) ?? []),
                    ...(items?.tasks.map((task) => ({
                      key: task.id,
                      label: task.label,
                      tone: task.done ? ("done" as const) : ("task" as const),
                    })) ?? []),
                  ];
                  return (
                    <div key={date} role="gridcell" className="border-r border-b border-border last:border-r-0">
                      <button
                        type="button"
                        onClick={() => selectDay(date)}
                        aria-pressed={isSelected}
                        aria-label={[
                          formatDate(date, { weekday: "long", day: "numeric", month: "long" }),
                          isWedding ? t("weddingDay") : null,
                          count > 0 ? t("itemsCount", { count }) : null,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                        className={cn(
                          "flex h-full min-h-16 w-full flex-col gap-1 p-1.5 text-left transition-colors sm:min-h-28 sm:p-2",
                          !inMonth && "opacity-40",
                          isWedding ? "bg-terracotta/10" : "hover:bg-linen/70",
                          isSelected && "ring-2 ring-charcoal ring-inset",
                        )}
                      >
                        <span className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              "grid size-6 place-items-center rounded-full text-sm tabular-nums",
                              isToday && "bg-charcoal text-ivory",
                            )}
                          >
                            {Number(date.slice(8))}
                          </span>
                          {isWedding && (
                            <HeartIcon aria-hidden className="size-3.5 fill-terracotta text-terracotta" />
                          )}
                        </span>
                        {/* Mobile : des points ; écran large : les intitulés. */}
                        <span className="flex flex-wrap gap-1 sm:hidden" aria-hidden>
                          {chips.slice(0, 3).map((chip) => (
                            <span key={chip.key} className={cn("size-1.5 rounded-full", DOT[chip.tone])} />
                          ))}
                        </span>
                        <span className="hidden min-w-0 flex-col gap-1 sm:flex" aria-hidden>
                          {chips.slice(0, 2).map((chip) => (
                            <span
                              key={chip.key}
                              className={cn("truncate rounded-md px-1.5 py-0.5 text-xs", CHIP[chip.tone])}
                            >
                              {chip.label}
                            </span>
                          ))}
                          {chips.length > 2 && (
                            <span className="px-1.5 text-xs text-stone">
                              {t("more", { count: chips.length - 2 })}
                            </span>
                          )}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone">
          <li className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", DOT.event)} aria-hidden />
            {t("legend.event")}
          </li>
          <li className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", DOT.task)} aria-hidden />
            {t("legend.task")}
          </li>
          {weddingDate && (
            <li className="flex items-center gap-2">
              <HeartIcon aria-hidden className="size-3.5 fill-terracotta text-terracotta" />
              {t("legend.wedding")}
            </li>
          )}
        </ul>
      </section>

      <section
        aria-labelledby="calendar-day"
        className="flex flex-col gap-5 rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="calendar-day" className="font-serif text-2xl first-letter:uppercase">
            {formatDate(selected, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </h2>
          <button
            type="button"
            onClick={() => setDialog({ open: true, event: null })}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-sage-deep px-5 text-sm font-medium text-ivory transition-colors hover:bg-[#35402f]"
          >
            <PlusIcon aria-hidden className="size-4" />
            {t("addCta")}
          </button>
        </div>

        {selected === weddingDate && (
          <p className="flex items-center gap-2 font-serif text-lg text-terracotta">
            <HeartIcon aria-hidden className="size-4 fill-terracotta" />
            {t("weddingDay")}
          </p>
        )}

        {selectedItems.events.length === 0 && selectedItems.tasks.length === 0 ? (
          <p className="text-stone">{t("emptyDay")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {selectedItems.events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                onEdit={() => setDialog({ open: true, event })}
              />
            ))}
            {selectedItems.tasks.map((task) => (
              <li key={task.id} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                <span className={cn("mt-2 size-2 shrink-0 rounded-full", DOT[task.done ? "done" : "task"])} aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className={cn("wrap-break-word", task.done && "text-stone line-through")}>
                    {task.label}
                  </span>
                  <span className="text-xs tracking-wide text-stone/80 uppercase">{t("taskLabel")}</span>
                </div>
                <Link
                  href="/planning"
                  className="group inline-flex shrink-0 items-center gap-1 text-sm font-medium text-sage-deep"
                >
                  {t("openPlanning")}
                  <ArrowRightIcon aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {upcoming.length > 0 && (
        <section aria-labelledby="calendar-upcoming" className="flex flex-col gap-4">
          <h2 id="calendar-upcoming" className="font-serif text-2xl">
            {t("upcoming")}
          </h2>
          <ul className="flex flex-col gap-2">
            {upcoming.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => selectDay(event.event_date)}
                  className="flex w-full items-baseline gap-4 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-linen"
                >
                  <span className="w-28 shrink-0 text-sm text-stone tabular-nums first-letter:uppercase">
                    {formatDate(event.event_date, { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{event.title}</span>
                  {event.start_time && (
                    <span className="text-sm text-stone tabular-nums">{event.start_time}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CalendarEventDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        event={dialog.event}
        defaultDate={selected}
      />
    </div>
  );
}

const DOT = {
  event: "bg-terracotta",
  task: "bg-sage-deep",
  done: "bg-sand",
} as const;

const CHIP = {
  event: "bg-terracotta/10 text-terracotta",
  task: "bg-sage-soft text-sage-deep",
  done: "bg-linen text-stone line-through",
} as const;

/** Rendez-vous dans le détail du jour : modification et suppression. */
function EventRow({ event, onEdit }: { event: CalendarEvent; onEdit: () => void }) {
  const t = useTranslations("Calendar");
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof deleteCalendarEvent>>;
      try {
        result = await deleteCalendarEvent(event.id);
      } catch {
        result = { ok: false, error: "generic" };
      }
      if (result.ok) toast(t("toasts.deleted", { title: event.title }));
      else toast.error(t("toasts.error"));
    });
  }

  return (
    <li className={cn("flex items-start gap-4 py-4 first:pt-0 last:pb-0", pending && "opacity-50")}>
      <span className="w-12 shrink-0 pt-0.5 text-sm text-stone tabular-nums">
        {event.start_time ?? t("allDay")}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="wrap-break-word">{event.title}</span>
        <span className="text-xs tracking-wide text-terracotta uppercase">{t(`kinds.${event.kind}`)}</span>
        {event.location && (
          <span className="flex items-center gap-1.5 text-sm text-stone">
            <MapPinIcon aria-hidden className="size-3.5 shrink-0" />
            <span className="wrap-break-word">{event.location}</span>
          </span>
        )}
        {event.notes && <p className="text-sm text-pretty whitespace-pre-line text-stone">{event.notes}</p>}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          aria-label={t("editLabel", { title: event.title })}
          className="text-stone hover:text-sage-deep"
        >
          <PencilLineIcon aria-hidden />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              aria-label={t("delete.trigger", { title: event.title })}
              className="text-stone hover:text-terracotta"
            >
              <Trash2Icon aria-hidden />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-serif text-xl">
                {t("delete.title", { title: event.title })}
              </AlertDialogTitle>
              <AlertDialogDescription>{t("delete.description")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("delete.cancel")}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={remove}>
                {t("delete.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}

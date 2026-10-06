"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addCalendarEvent, updateCalendarEvent } from "@/lib/calendar/actions";
import {
  CALENDAR_EVENT_KINDS,
  CALENDAR_LIMITS,
  parseCalendarEvent,
  type CalendarEvent,
  type CalendarEventField,
  type CalendarEventInput,
  type CalendarFieldErrors,
} from "@/lib/calendar/schema";

type CalendarEventDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rendez-vous à modifier ; absent, la modale en crée un. */
  event: CalendarEvent | null;
  /** Date proposée pour un nouveau rendez-vous (jour sélectionné). */
  defaultDate: string;
};

const controlClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Ajout ou modification d'un rendez-vous, en modale. */
export function CalendarEventDialog({
  open,
  onOpenChange,
  event,
  defaultDate,
}: CalendarEventDialogProps) {
  const t = useTranslations("Calendar");
  const mode = event ? "edit" : "add";
  const [fieldErrors, setFieldErrors] = useState<CalendarFieldErrors>({});
  const [pending, startTransition] = useTransition();

  function changeOpen(next: boolean) {
    onOpenChange(next);
    if (!next) setFieldErrors({});
  }

  function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const data = new FormData(formEvent.currentTarget);
    const input: CalendarEventInput = {
      kind: String(data.get("kind") ?? "") as CalendarEventInput["kind"],
      title: String(data.get("title") ?? ""),
      date: String(data.get("date") ?? ""),
      time: String(data.get("time") ?? ""),
      location: String(data.get("location") ?? ""),
      notes: String(data.get("notes") ?? ""),
    };
    const parsed = parseCalendarEvent(input);
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      return;
    }

    startTransition(async () => {
      let result: Awaited<ReturnType<typeof addCalendarEvent>>;
      try {
        result = event ? await updateCalendarEvent(event.id, input) : await addCalendarEvent(input);
      } catch {
        result = { ok: false, error: "generic" };
      }
      if (!result.ok) {
        toast.error(t("toasts.error"));
        return;
      }
      toast.success(t(`toasts.${mode}`, { title: parsed.data.title }));
      changeOpen(false);
    });
  }

  const fieldProps = (field: CalendarEventField) => ({
    id: `calendar-${field}`,
    name: field,
    "aria-invalid": fieldErrors[field] ? true : undefined,
    "aria-describedby": fieldErrors[field] ? `calendar-${field}-error` : undefined,
  });

  const fieldError = (field: CalendarEventField) => {
    const error = fieldErrors[field];
    return error ? (
      <p id={`calendar-${field}-error`} className="text-sm text-destructive">
        {t(`fieldErrors.${error}`)}
      </p>
    ) : null;
  };

  const optional = <span className="font-normal text-stone">{t("form.optional")}</span>;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent closeLabel={t("form.close")} className="gap-6 rounded-3xl p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t(`${mode}.title`)}</DialogTitle>
          <DialogDescription>{t(`${mode}.description`)}</DialogDescription>
        </DialogHeader>

        {/* key : la saisie repart des valeurs du rendez-vous ouvert. */}
        <form
          key={event?.id ?? defaultDate}
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
          noValidate
          aria-busy={pending}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="calendar-title">{t("form.title")}</Label>
            <Input
              {...fieldProps("title")}
              autoComplete="off"
              placeholder={t("form.titlePlaceholder")}
              defaultValue={event?.title}
              maxLength={CALENDAR_LIMITS.title}
              required
              className="h-11 text-base"
            />
            {fieldError("title")}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="calendar-kind">{t("form.kind")}</Label>
            <select
              {...fieldProps("kind")}
              defaultValue={event?.kind ?? "appointment"}
              className={controlClass}
            >
              {CALENDAR_EVENT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`kinds.${kind}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="calendar-date">{t("form.date")}</Label>
              <Input
                {...fieldProps("date")}
                type="date"
                defaultValue={event?.event_date ?? defaultDate}
                required
                className="h-11 text-base tabular-nums"
              />
              {fieldError("date")}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="calendar-time">
                {t("form.time")} {optional}
              </Label>
              <Input
                {...fieldProps("time")}
                type="time"
                step={60}
                defaultValue={event?.start_time ?? ""}
                className="h-11 text-base tabular-nums"
              />
              {fieldError("time")}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="calendar-location">
              {t("form.location")} {optional}
            </Label>
            <Input
              {...fieldProps("location")}
              autoComplete="off"
              placeholder={t("form.locationPlaceholder")}
              defaultValue={event?.location ?? ""}
              maxLength={CALENDAR_LIMITS.location}
              className="h-11 text-base"
            />
            {fieldError("location")}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="calendar-notes">
              {t("form.notes")} {optional}
            </Label>
            <textarea
              {...fieldProps("notes")}
              rows={3}
              placeholder={t("form.notesPlaceholder")}
              defaultValue={event?.notes ?? ""}
              maxLength={CALENDAR_LIMITS.notes}
              className="w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
            />
            {fieldError("notes")}
          </div>

          <DialogFooter className="mx-0 mt-2 mb-0 rounded-none border-t-0 bg-transparent p-0">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="lg" className="h-11 rounded-full">
                {t("form.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" disabled={pending} className="h-11 rounded-full px-6">
              {t(`${mode}.submit`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

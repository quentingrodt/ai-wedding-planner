"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
import {
  GUEST_EVENTS,
  SEATED_EVENT,
  sortGuestEvents,
  summarizeGuestEvents,
  type GuestEvent,
} from "@/lib/guests/schema";
import { cn } from "@/lib/utils";

type GuestEventsPickerProps = {
  value: readonly GuestEvent[];
  onChange: (events: GuestEvent[]) => void;
  /** Libellé accessible du groupe de boutons. */
  label: string;
};

/** Pastilles à cocher, une par étape ; la dernière étape cochée ne peut pas être retirée. */
export function GuestEventsPicker({ value, onChange, label }: GuestEventsPickerProps) {
  const t = useTranslations("Guests.events");

  function toggle(event: GuestEvent) {
    if (value.includes(event)) {
      if (value.length === 1) return;
      onChange(value.filter((current) => current !== event));
    } else {
      onChange(sortGuestEvents([...value, event]));
    }
  }

  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {GUEST_EVENTS.map((event) => {
        const selected = value.includes(event);
        return (
          <button
            key={event}
            type="button"
            aria-pressed={selected}
            aria-disabled={selected && value.length === 1 ? true : undefined}
            onClick={() => toggle(event)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              selected
                ? "bg-sage-soft text-charcoal ring-1 ring-sage/40"
                : "bg-card text-stone ring-1 ring-border hover:bg-linen/60",
            )}
          >
            {selected && <CheckIcon aria-hidden className="size-3.5 text-sage-deep" />}
            {t(event)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Résumé des étapes : la journée habituelle reste discrète,
 * les exceptions ressortent.
 */
export function GuestEventsLabel({
  events,
  className,
}: {
  events: readonly GuestEvent[];
  className?: string;
}) {
  const t = useTranslations("Guests.events");
  const summary = summarizeGuestEvents(events);
  const exception = summary.kind === "partial" || summary.brunch;
  const text =
    summary.kind === "fullDay"
      ? t(summary.brunch ? "fullDayAndBrunch" : "fullDay")
      : summary.events.map((event) => t(event)).join(" · ");
  return (
    <span className={cn(exception ? "text-charcoal" : "text-stone", className)}>{text}</span>
  );
}

type GuestEventsDialogProps = {
  guestName: string;
  events: GuestEvent[];
  onSave: (events: GuestEvent[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Choix des étapes en modale. Le brouillon part des étapes au montage :
 * le parent remonte la modale à chaque ouverture.
 */
export function GuestEventsDialog({
  guestName,
  events,
  onSave,
  open,
  onOpenChange,
}: GuestEventsDialogProps) {
  const t = useTranslations("Guests.events");
  const [draft, setDraft] = useState<GuestEvent[]>(events);

  function save() {
    onOpenChange(false);
    if (draft.join() !== events.join()) onSave(draft);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("close")} className="gap-6 rounded-3xl p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t("title", { name: guestName })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <GuestEventsPicker value={draft} onChange={setDraft} label={t("label")} />
        {!draft.includes(SEATED_EVENT) && (
          <p className="rounded-2xl bg-linen px-4 py-3 text-sm text-stone">{t("noDinner")}</p>
        )}
        <DialogFooter className="mx-0 mt-2 mb-0 rounded-none border-t-0 bg-transparent p-0">
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="lg" className="h-11 rounded-full">
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button type="button" size="lg" onClick={save} className="h-11 rounded-full px-6">
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

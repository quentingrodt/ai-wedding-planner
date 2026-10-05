"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ITINERARY_LIMITS,
  parseEvent,
  type EventField,
  type EventFieldErrors,
  type EventInput,
  type ItineraryEvent,
} from "@/lib/itinerary/schema";

type EventDialogProps = {
  /** Étape à modifier ; absente, la modale crée une nouvelle étape. */
  event?: ItineraryEvent;
  trigger: ReactNode;
  /** Appelée avec une saisie déjà validée : la modale se ferme aussitôt. */
  onSubmit: (input: EventInput) => void;
};

/** Formulaire d'ajout ou de modification d'une étape, en modale. */
export function EventDialog({ event, trigger, onSubmit }: EventDialogProps) {
  const t = useTranslations("Itinerary");
  const mode = event ? "edit" : "add";
  const [open, setOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<EventFieldErrors>({});

  // Le contenu de la modale est démonté à la fermeture : la saisie repart à zéro.
  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setFieldErrors({});
  }

  function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const data = new FormData(formEvent.currentTarget);
    const input: EventInput = {
      startTime: String(data.get("startTime") ?? ""),
      title: String(data.get("title") ?? ""),
      location: String(data.get("location") ?? ""),
      description: String(data.get("description") ?? ""),
    };

    // Même schéma que le serveur : on ne ferme qu'une saisie valide,
    // ce qui permet d'afficher l'étape avant la réponse du serveur.
    const parsed = parseEvent(input);
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      return;
    }
    onSubmit(input);
    changeOpen(false);
  }

  const fieldProps = (field: EventField) => {
    const error = fieldErrors[field];
    return {
      id: `event-${field}`,
      name: field,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `event-${field}-error` : undefined,
    };
  };

  const fieldError = (field: EventField) => {
    const error = fieldErrors[field];
    return error ? (
      <p id={`event-${field}-error`} className="text-sm text-destructive">
        {t(`fieldErrors.${error}`)}
      </p>
    ) : null;
  };

  const optional = (
    <span className="font-normal text-stone">{t("form.optional")}</span>
  );

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={t("form.close")} className="gap-6 rounded-3xl p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t(`${mode}.title`)}</DialogTitle>
          <DialogDescription>{t(`${mode}.description`)}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div className="grid gap-5 sm:grid-cols-[8rem_1fr]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-startTime">{t("form.startTime")}</Label>
              <Input
                {...fieldProps("startTime")}
                type="time"
                step={60}
                defaultValue={event?.start_time}
                required
                className="h-11 text-base tabular-nums"
              />
              {fieldError("startTime")}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-title">{t("form.title")}</Label>
              <Input
                {...fieldProps("title")}
                type="text"
                autoComplete="off"
                placeholder={t("form.titlePlaceholder")}
                defaultValue={event?.title}
                maxLength={ITINERARY_LIMITS.title}
                required
                className="h-11 text-base"
              />
              {fieldError("title")}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="event-location">
              {t("form.location")} {optional}
            </Label>
            <Input
              {...fieldProps("location")}
              type="text"
              autoComplete="off"
              placeholder={t("form.locationPlaceholder")}
              defaultValue={event?.location ?? ""}
              maxLength={ITINERARY_LIMITS.location}
              className="h-11 text-base"
            />
            {fieldError("location")}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="event-description">
              {t("form.description")} {optional}
            </Label>
            <textarea
              {...fieldProps("description")}
              rows={3}
              placeholder={t("form.descriptionPlaceholder")}
              defaultValue={event?.description ?? ""}
              maxLength={ITINERARY_LIMITS.description}
              className="w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
            />
            {fieldError("description")}
          </div>

          <DialogFooter className="mx-0 mt-2 mb-0 rounded-none border-t-0 bg-transparent p-0">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="lg" className="h-11 rounded-full">
                {t("form.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" className="h-11 rounded-full px-6">
              {t(`${mode}.submit`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

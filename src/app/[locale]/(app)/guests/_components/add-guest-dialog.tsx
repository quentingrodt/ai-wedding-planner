"use client";

import { UserPlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_GUEST_EVENTS,
  GUEST_LIMITS,
  type GuestFamily,
  type AddGuestInput,
  type GuestField,
  type GuestEvent,
  type GuestFieldError,
  type GuestStatus,
} from "@/lib/guests/schema";
import { addGuest } from "../actions";
import { GuestEventsPicker } from "./guest-events";
import { GuestStatusSelect } from "./guest-status";

type FieldErrors = Partial<Record<GuestField, GuestFieldError>>;

// Radix Select refuse une valeur vide : « aucune famille » a sa propre valeur.
const NO_FAMILY = "none";

type AddGuestDialogProps = {
  families: GuestFamily[];
  /** Famille présélectionnée (ajout depuis la fiche d'une famille). */
  defaultFamilyId?: string | null;
  /** Déclencheur personnalisé ; par défaut, le bouton « Ajouter un invité ». */
  trigger?: ReactNode;
};

/** Bouton « Ajouter un invité » et son formulaire en modale. */
export function AddGuestDialog({ families, defaultFamilyId = null, trigger }: AddGuestDialogProps) {
  const t = useTranslations("Guests");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<GuestStatus>("invited");
  const [familyId, setFamilyId] = useState<string | null>(defaultFamilyId);
  const [events, setEvents] = useState<GuestEvent[]>([...DEFAULT_GUEST_EVENTS]);

  // Le contenu de la modale est démonté à la fermeture : la saisie repart à zéro.
  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setFieldErrors({});
      setStatus("invited");
      setFamilyId(defaultFamilyId);
      setEvents([...DEFAULT_GUEST_EVENTS]);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input: AddGuestInput = {
      firstName: String(data.get("firstName") ?? ""),
      lastName: String(data.get("lastName") ?? ""),
      status,
      dietaryRequirements: String(data.get("dietaryRequirements") ?? ""),
      isChild: data.get("isChild") === "on",
      familyId,
      events,
    };

    startTransition(async () => {
      const result = await addGuest(input);
      if (result.ok) {
        toast(t("add.success", { name: input.firstName.trim() }));
        changeOpen(false);
        return;
      }
      setFieldErrors(result.fieldErrors ?? {});
      if (result.error !== "invalid") toast.error(t(`errors.${result.error}`));
    });
  }

  const fieldProps = (field: GuestField) => {
    const error = fieldErrors[field];
    return {
      id: `guest-${field}`,
      name: field,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `guest-${field}-error` : undefined,
    };
  };

  const fieldError = (field: GuestField) => {
    const error = fieldErrors[field];
    return error ? (
      <p id={`guest-${field}-error`} className="text-sm text-destructive">
        {t(`fieldErrors.${error}`)}
      </p>
    ) : null;
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="lg" className="h-11 rounded-full px-5">
            <UserPlusIcon aria-hidden />
            {t("add.trigger")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent closeLabel={t("add.close")} className="gap-6 rounded-3xl p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t("add.title")}</DialogTitle>
          <DialogDescription>{t("add.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="guest-firstName">{t("add.firstName")}</Label>
              <Input
                {...fieldProps("firstName")}
                type="text"
                autoComplete="off"
                maxLength={GUEST_LIMITS.firstName}
                required
                className="h-11 text-base"
              />
              {fieldError("firstName")}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="guest-lastName">
                {t("add.lastName")}{" "}
                <span className="font-normal text-stone">{t("add.optional")}</span>
              </Label>
              <Input
                {...fieldProps("lastName")}
                type="text"
                autoComplete="off"
                maxLength={GUEST_LIMITS.lastName}
                className="h-11 text-base"
              />
              {fieldError("lastName")}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="guest-status">{t("add.status")}</Label>
            <GuestStatusSelect
              id="guest-status"
              status={status}
              onChange={setStatus}
              className="h-11 w-full data-[size=sm]:h-11"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span aria-hidden className="text-sm leading-none font-medium">
              {t("events.label")}
            </span>
            <GuestEventsPicker value={events} onChange={setEvents} label={t("events.label")} />
            <p className="text-sm text-muted-foreground">{t("events.hint")}</p>
          </div>

          {families.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="guest-family">
                {t("add.family")}{" "}
                <span className="font-normal text-stone">{t("add.optional")}</span>
              </Label>
              <Select
                value={familyId ?? NO_FAMILY}
                onValueChange={(value) => setFamilyId(value === NO_FAMILY ? null : value)}
              >
                <SelectTrigger id="guest-family" className="h-11 w-full data-[size=default]:h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FAMILY}>{t("add.noFamily")}</SelectItem>
                  {families.map((family) => (
                    <SelectItem key={family.id} value={family.id}>
                      {family.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="guest-dietaryRequirements">
              {t("add.dietary")}{" "}
              <span className="font-normal text-stone">{t("add.optional")}</span>
            </Label>
            <Input
              {...fieldProps("dietaryRequirements")}
              type="text"
              autoComplete="off"
              placeholder={t("add.dietaryPlaceholder")}
              maxLength={GUEST_LIMITS.dietaryRequirements}
              aria-describedby={
                fieldErrors.dietaryRequirements
                  ? "guest-dietaryRequirements-error guest-dietary-hint"
                  : "guest-dietary-hint"
              }
              className="h-11 text-base"
            />
            <p id="guest-dietary-hint" className="text-sm text-muted-foreground">
              {t("add.dietaryHint")}
            </p>
            {fieldError("dietaryRequirements")}
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="isChild"
              className="size-5 cursor-pointer rounded accent-sage"
            />
            {t("add.isChild")}
          </label>

          <DialogFooter className="mx-0 mt-2 mb-0 rounded-none border-t-0 bg-transparent p-0">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="lg" className="h-11 rounded-full">
                {t("add.cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className="h-11 rounded-full px-6"
            >
              {pending ? t("add.submitting") : t("add.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

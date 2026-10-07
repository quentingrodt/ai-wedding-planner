"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type ChangeEvent, type FormEvent, type ReactNode } from "react";
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
import { LODGING_KINDS, LODGING_STATUSES, type LodgingKind, type LodgingStatus } from "@/lib/lodging/catalog";
import { LODGING_LIMITS, type Lodging, type LodgingActionResult } from "@/lib/lodging/schema";
import { saveLodging } from "../actions";

/** Valeurs de départ d'un nouvel hébergement (astuce, lieu retenu). */
export type LodgingPreset = { name?: string; kind?: LodgingKind; location?: string | null };

type LodgingDialogProps = {
  /** Hébergement à modifier, ou null pour en ajouter un. */
  lodging: Lodging | null;
  preset?: LodgingPreset;
  currencySymbol: string;
  /** Déclencheur ; sans lui, la fiche est pilotée par open et onOpenChange. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type FormState = {
  name: string;
  kind: LodgingKind;
  status: LodgingStatus;
  location: string;
  travelMinutes: string;
  rooms: string;
  pricePerNight: string;
  groupRate: boolean;
  bookingCode: string;
  deadline: string;
  url: string;
  contact: string;
  notes: string;
};

const digits = (value: number | null | undefined) => (value == null ? "" : String(value));

function initialState(lodging: Lodging | null, preset: LodgingPreset | undefined): FormState {
  return {
    name: lodging?.name ?? preset?.name ?? "",
    kind: lodging?.kind ?? preset?.kind ?? "hotel",
    status: lodging?.status ?? "idea",
    location: lodging?.location ?? preset?.location ?? "",
    travelMinutes: digits(lodging?.travel_minutes),
    rooms: digits(lodging?.rooms),
    pricePerNight: digits(lodging?.price_per_night),
    groupRate: lodging?.group_rate ?? false,
    bookingCode: lodging?.booking_code ?? "",
    deadline: lodging?.deadline ?? "",
    url: lodging?.url ?? "",
    contact: lodging?.contact ?? "",
    notes: lodging?.notes ?? "",
  };
}

const toNumber = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const fieldClass = "h-11 rounded-xl bg-card text-base";
const selectClass = "h-11 w-full rounded-xl bg-card data-[size=default]:h-11";

/** Fiche d'un hébergement : où, combien de chambres, à quel prix, jusqu'à quand. */
export function LodgingDialog({
  lodging,
  preset,
  currencySymbol,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: LodgingDialogProps) {
  const t = useTranslations("Lodging");
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(() => initialState(lodging, preset));
  const [nameError, setNameError] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((current) => ({ ...current, [key]: value }));
  const numeric = (key: "travelMinutes" | "rooms" | "pricePerNight", max: number) =>
    (event: ChangeEvent<HTMLInputElement>) =>
      set(key, event.target.value.replace(/\D/g, "").slice(0, String(max).length));

  function changeOpen(next: boolean) {
    if (controlledOpen === undefined) setOwnOpen(next);
    onOpenChange?.(next);
    if (next) {
      setState(initialState(lodging, preset));
      setNameError(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.name.trim() === "") {
      setNameError(true);
      return;
    }
    startTransition(async () => {
      const result = await saveLodging(lodging?.id ?? null, {
        ...state,
        travelMinutes: toNumber(state.travelMinutes),
        rooms: toNumber(state.rooms) || null,
        pricePerNight: toNumber(state.pricePerNight),
      }).catch((): LodgingActionResult => ({ ok: false, error: "generic" }));
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      toast(lodging ? t("dialog.updated") : t("dialog.added", { name: state.name.trim() }));
      changeOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent closeLabel={t("close")} className="max-h-[92dvh] gap-6 overflow-y-auto rounded-3xl p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{lodging ? t("dialog.editTitle") : t("dialog.addTitle")}</DialogTitle>
          <DialogDescription>{t("dialog.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lodging-name">{t("fields.name")}</Label>
            <Input
              id="lodging-name"
              value={state.name}
              maxLength={LODGING_LIMITS.name}
              placeholder={t("fields.namePlaceholder")}
              aria-invalid={nameError || undefined}
              onChange={(event) => {
                set("name", event.target.value);
                setNameError(false);
              }}
              className={fieldClass}
            />
            {nameError && <p className="text-sm text-destructive">{t("dialog.nameRequired")}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lodging-kind">{t("fields.kind")}</Label>
              <Select value={state.kind} onValueChange={(value) => set("kind", value as LodgingKind)}>
                <SelectTrigger id="lodging-kind" className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LODGING_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>{t(`kinds.${kind}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lodging-status">{t("fields.status")}</Label>
              <Select value={state.status} onValueChange={(value) => set("status", value as LodgingStatus)}>
                <SelectTrigger id="lodging-status" className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LODGING_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{t(`statuses.${status}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lodging-location">{t("fields.location")}</Label>
              <Input
                id="lodging-location"
                value={state.location}
                maxLength={LODGING_LIMITS.location}
                onChange={(event) => set("location", event.target.value)}
                className={fieldClass}
              />
            </div>
            <NumberField
              id="lodging-travel"
              label={t("fields.travelMinutes")}
              value={state.travelMinutes}
              unit={t("units.minutes")}
              onChange={numeric("travelMinutes", LODGING_LIMITS.travelMinutes)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              id="lodging-rooms"
              label={t("fields.rooms")}
              value={state.rooms}
              unit={t("units.rooms")}
              onChange={numeric("rooms", LODGING_LIMITS.rooms)}
            />
            <NumberField
              id="lodging-price"
              label={t("fields.pricePerNight")}
              value={state.pricePerNight}
              unit={currencySymbol}
              onChange={numeric("pricePerNight", LODGING_LIMITS.pricePerNight)}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-2xl bg-linen/60 p-4">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={state.groupRate}
                onChange={(event) => set("groupRate", event.target.checked)}
                className="size-4 accent-sage-deep"
              />
              {t("fields.groupRate")}
            </label>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lodging-code">{t("fields.bookingCode")}</Label>
              <Input
                id="lodging-code"
                value={state.bookingCode}
                maxLength={LODGING_LIMITS.bookingCode}
                placeholder={t("fields.bookingCodePlaceholder")}
                onChange={(event) => set("bookingCode", event.target.value)}
                className={fieldClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lodging-deadline">{t("fields.deadline")}</Label>
              <Input
                id="lodging-deadline"
                type="date"
                value={state.deadline}
                onChange={(event) => set("deadline", event.target.value)}
                className={`${fieldClass} w-48`}
              />
              <p className="text-xs text-stone">{t("fields.deadlineHint")}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lodging-url">{t("fields.url")}</Label>
              <Input
                id="lodging-url"
                type="url"
                inputMode="url"
                value={state.url}
                maxLength={LODGING_LIMITS.url}
                placeholder="https://"
                onChange={(event) => set("url", event.target.value)}
                className={fieldClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lodging-contact">{t("fields.contact")}</Label>
              <Input
                id="lodging-contact"
                value={state.contact}
                maxLength={LODGING_LIMITS.contact}
                placeholder={t("fields.contactPlaceholder")}
                onChange={(event) => set("contact", event.target.value)}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lodging-notes">{t("fields.notes")}</Label>
            <textarea
              id="lodging-notes"
              value={state.notes}
              maxLength={LODGING_LIMITS.notes}
              placeholder={t("fields.notesPlaceholder")}
              onChange={(event) => set("notes", event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-base leading-6 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
            <p className="text-xs text-stone">{t("fields.notesHint")}</p>
          </div>

          <DialogFooter className="mx-0 mt-2 mb-0 rounded-none border-t-0 bg-transparent p-0">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="lg" className="h-11 rounded-full">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" disabled={pending} className="h-11 rounded-full px-6">
              {pending ? t("saving") : lodging ? t("save") : t("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NumberField({
  id,
  label,
  value,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  unit: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input id={id} inputMode="numeric" value={value} onChange={onChange} className={`${fieldClass} w-24`} />
        <span className="text-stone">{unit}</span>
      </div>
    </div>
  );
}

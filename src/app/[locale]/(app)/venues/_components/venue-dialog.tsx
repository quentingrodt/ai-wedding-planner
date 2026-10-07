"use client";

import { MinusIcon, PlusIcon, XIcon } from "lucide-react";
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
import {
  VENUE_CATERINGS,
  VENUE_CRITERIA,
  VENUE_DATE_STATUSES,
  VENUE_STYLES,
  type VenueCriterion,
} from "@/lib/venues/catalog";
import {
  EDITABLE_STATUSES,
  ratingOf,
  VENUE_LIMITS,
  type Venue,
  type VenueInput,
} from "@/lib/venues/schema";
import { saveVenue } from "../actions";
import { RatingInput } from "./rating";

type VenueDialogProps = {
  /** Lieu à modifier, ou null pour en ajouter un. */
  venue: Venue | null;
  currencySymbol: string;
  trigger: ReactNode;
};

type FormState = {
  name: string;
  status: (typeof EDITABLE_STATUSES)[number];
  url: string;
  visitDate: string;
  location: string;
  travelMinutes: string;
  capacity: string;
  price: string;
  style: string;
  beds: string;
  accommodationNote: string;
  catering: string;
  curfew: string;
  restrictions: string;
  dateStatus: string;
  datesNote: string;
  ratings: Partial<Record<VenueCriterion, number | null>>;
  pros: string[];
  cons: string[];
  notes: string;
};

// Valeur des listes déroulantes pour « non renseigné » (Radix refuse une valeur vide).
const UNSET = "unset";

const digits = (value: number | null) => (value === null ? "" : String(value));

function initialState(venue: Venue | null): FormState {
  return {
    name: venue?.name ?? "",
    status: venue && venue.status !== "booked" ? venue.status : "idea",
    url: venue?.url ?? "",
    visitDate: venue?.visit_date ?? "",
    location: venue?.location ?? "",
    travelMinutes: digits(venue?.travel_minutes ?? null),
    capacity: digits(venue?.capacity ?? null),
    price: digits(venue?.price ?? null),
    style: venue?.style ?? UNSET,
    beds: digits(venue?.beds ?? null),
    accommodationNote: venue?.accommodation_note ?? "",
    catering: venue?.catering ?? UNSET,
    curfew: venue?.curfew?.slice(0, 5) ?? "",
    restrictions: venue?.restrictions ?? "",
    dateStatus: venue?.date_status ?? UNSET,
    datesNote: venue?.dates_note ?? "",
    ratings: venue
      ? Object.fromEntries(VENUE_CRITERIA.map((criterion) => [criterion, ratingOf(venue, criterion)]))
      : {},
    pros: venue?.pros ?? [],
    cons: venue?.cons ?? [],
    notes: venue?.notes ?? "",
  };
}

const toNumber = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};
const orNull = <T extends string>(value: string) => (value === UNSET ? null : (value as T));

function toInput(state: FormState, keepStatus: boolean): VenueInput {
  return {
    name: state.name,
    ...(!keepStatus && { status: state.status }),
    url: state.url,
    visitDate: state.visitDate,
    location: state.location,
    travelMinutes: toNumber(state.travelMinutes),
    capacity: toNumber(state.capacity) || null,
    price: toNumber(state.price),
    style: orNull(state.style),
    beds: toNumber(state.beds),
    accommodationNote: state.accommodationNote,
    catering: orNull(state.catering),
    curfew: state.curfew,
    restrictions: state.restrictions,
    dateStatus: orNull(state.dateStatus),
    datesNote: state.datesNote,
    ratings: state.ratings,
    pros: state.pros,
    cons: state.cons,
    notes: state.notes,
  };
}

const textareaClass =
  "w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-base leading-6 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
const fieldClass = "h-11 rounded-xl bg-card text-base";
const selectClass = "h-11 w-full rounded-xl bg-card data-[size=default]:h-11";

/** Fiche d'un lieu : l'essentiel, puis chaque critère avec ses faits et la note des mariés. */
export function VenueDialog({ venue, currencySymbol, trigger }: VenueDialogProps) {
  const t = useTranslations("Venues");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(() => initialState(venue));
  const [nameError, setNameError] = useState(false);
  const isBooked = venue?.status === "booked";

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((current) => ({ ...current, [key]: value }));
  const numeric = (key: keyof FormState, max: number) => (event: ChangeEvent<HTMLInputElement>) =>
    set(key, event.target.value.replace(/\D/g, "").slice(0, String(max).length) as never);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setState(initialState(venue));
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
      const result = await saveVenue(venue?.id ?? null, toInput(state, isBooked)).catch(() => ({
        ok: false as const,
        error: "generic" as const,
      }));
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      toast(venue ? t("dialog.updated") : t("dialog.added", { name: state.name.trim() }));
      setOpen(false);
    });
  }

  const criterionSection = (criterion: VenueCriterion, children: ReactNode) => (
    <fieldset className="flex flex-col gap-4 rounded-2xl bg-linen/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <legend className="font-serif text-lg">{t(`criteria.${criterion}.label`)}</legend>
        <RatingInput
          label={t("dialog.ratingLabel", { criterion: t(`criteria.${criterion}.label`) })}
          value={state.ratings[criterion] ?? null}
          onChange={(value) => set("ratings", { ...state.ratings, [criterion]: value })}
        />
      </div>
      {children}
    </fieldset>
  );

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={t("close")} className="max-h-[92dvh] gap-6 overflow-y-auto rounded-3xl p-6 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{venue ? t("dialog.editTitle") : t("dialog.addTitle")}</DialogTitle>
          <DialogDescription>{t("dialog.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="venue-name">{t("fields.name")}</Label>
              <Input
                id="venue-name"
                value={state.name}
                maxLength={VENUE_LIMITS.name}
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="venue-status">{t("fields.status")}</Label>
              {isBooked ? (
                <p id="venue-status" className="flex h-11 items-center text-sage-deep">{t("statuses.booked")}</p>
              ) : (
                <Select value={state.status} onValueChange={(value) => set("status", value as FormState["status"])}>
                  <SelectTrigger id="venue-status" className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EDITABLE_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>{t(`statuses.${status}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="venue-visit">{t("fields.visitDate")}</Label>
              <Input
                id="venue-visit"
                type="date"
                value={state.visitDate}
                onChange={(event) => set("visitDate", event.target.value)}
                className={fieldClass}
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="venue-url">{t("fields.url")}</Label>
              <Input
                id="venue-url"
                type="url"
                inputMode="url"
                value={state.url}
                maxLength={VENUE_LIMITS.url}
                placeholder="https://"
                onChange={(event) => set("url", event.target.value)}
                className={fieldClass}
              />
            </div>
          </div>

          {criterionSection(
            "location",
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="venue-location">{t("fields.location")}</Label>
                <Input
                  id="venue-location"
                  value={state.location}
                  maxLength={VENUE_LIMITS.location}
                  placeholder={t("fields.locationPlaceholder")}
                  onChange={(event) => set("location", event.target.value)}
                  className={fieldClass}
                />
              </div>
              <NumberField
                id="venue-travel"
                label={t("fields.travelMinutes")}
                value={state.travelMinutes}
                unit={t("units.minutes")}
                onChange={numeric("travelMinutes", VENUE_LIMITS.travelMinutes)}
              />
            </div>,
          )}

          {criterionSection(
            "capacity",
            <NumberField
              id="venue-capacity"
              label={t("fields.capacity")}
              value={state.capacity}
              unit={t("units.guests")}
              onChange={numeric("capacity", VENUE_LIMITS.capacity)}
            />,
          )}

          {criterionSection(
            "budget",
            <NumberField
              id="venue-price"
              label={t("fields.price")}
              value={state.price}
              unit={currencySymbol}
              wide
              onChange={numeric("price", VENUE_LIMITS.price)}
            />,
          )}

          {criterionSection(
            "style",
            <div className="flex flex-col gap-2">
              <Label htmlFor="venue-style">{t("fields.style")}</Label>
              <Select value={state.style} onValueChange={(value) => set("style", value)}>
                <SelectTrigger id="venue-style" className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>{t("fields.unset")}</SelectItem>
                  {VENUE_STYLES.map((style) => (
                    <SelectItem key={style} value={style}>{t(`styles.${style}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>,
          )}

          {criterionSection(
            "accommodation",
            <div className="flex flex-col gap-4">
              <NumberField
                id="venue-beds"
                label={t("fields.beds")}
                value={state.beds}
                unit={t("units.beds")}
                onChange={numeric("beds", VENUE_LIMITS.beds)}
              />
              <TextArea
                id="venue-accommodation"
                label={t("fields.accommodationNote")}
                value={state.accommodationNote}
                max={VENUE_LIMITS.accommodationNote}
                placeholder={t("fields.accommodationPlaceholder")}
                onChange={(value) => set("accommodationNote", value)}
              />
            </div>,
          )}

          {criterionSection(
            "service",
            <div className="flex flex-col gap-2">
              <Label htmlFor="venue-catering">{t("fields.catering")}</Label>
              <Select value={state.catering} onValueChange={(value) => set("catering", value)}>
                <SelectTrigger id="venue-catering" className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>{t("fields.unset")}</SelectItem>
                  {VENUE_CATERINGS.map((catering) => (
                    <SelectItem key={catering} value={catering}>{t(`caterings.${catering}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>,
          )}

          {criterionSection(
            "restrictions",
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="venue-curfew">{t("fields.curfew")}</Label>
                <Input
                  id="venue-curfew"
                  type="time"
                  value={state.curfew}
                  onChange={(event) => set("curfew", event.target.value)}
                  className={`${fieldClass} w-36`}
                />
              </div>
              <TextArea
                id="venue-restrictions"
                label={t("fields.restrictions")}
                value={state.restrictions}
                max={VENUE_LIMITS.restrictions}
                placeholder={t("fields.restrictionsPlaceholder")}
                onChange={(value) => set("restrictions", value)}
              />
            </div>,
          )}

          {criterionSection(
            "flexibility",
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="venue-dates">{t("fields.dateStatus")}</Label>
                <Select value={state.dateStatus} onValueChange={(value) => set("dateStatus", value)}>
                  <SelectTrigger id="venue-dates" className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSET}>{t("fields.unset")}</SelectItem>
                    {VENUE_DATE_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>{t(`dateStatuses.${status}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <TextArea
                id="venue-dates-note"
                label={t("fields.datesNote")}
                value={state.datesNote}
                max={VENUE_LIMITS.datesNote}
                placeholder={t("fields.datesPlaceholder")}
                onChange={(value) => set("datesNote", value)}
              />
            </div>,
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <NoteListField
              kind="pros"
              items={state.pros}
              onChange={(items) => set("pros", items)}
            />
            <NoteListField
              kind="cons"
              items={state.cons}
              onChange={(items) => set("cons", items)}
            />
          </div>

          <TextArea
            id="venue-notes"
            label={t("fields.notes")}
            value={state.notes}
            max={VENUE_LIMITS.notes}
            placeholder={t("fields.notesPlaceholder")}
            onChange={(value) => set("notes", value)}
          />

          <DialogFooter className="mx-0 mt-2 mb-0 rounded-none border-t-0 bg-transparent p-0">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="lg" className="h-11 rounded-full">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" disabled={pending} className="h-11 rounded-full px-6">
              {pending ? t("saving") : venue ? t("save") : t("add")}
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
  wide,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  unit: string;
  wide?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={onChange}
          className={`${fieldClass} ${wide ? "w-36" : "w-24"}`}
        />
        <span className="text-stone">{unit}</span>
      </div>
    </div>
  );
}

function TextArea({
  id,
  label,
  value,
  max,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  max: number;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        value={value}
        maxLength={max}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        className={textareaClass}
      />
    </div>
  );
}

/** Liste d'avantages ou d'inconvénients : une ligne par point, ajoutée avec Entrée. */
function NoteListField({
  kind,
  items,
  onChange,
}: {
  kind: "pros" | "cons";
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const t = useTranslations("Venues");
  const [draft, setDraft] = useState("");
  const full = items.length >= VENUE_LIMITS.noteItems;
  const Icon = kind === "pros" ? PlusIcon : MinusIcon;

  function add() {
    const value = draft.trim();
    if (value === "" || full) return;
    onChange([...items, value]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`venue-${kind}`}>{t(`fields.${kind}`)}</Label>
      {items.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex items-start gap-2 rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-border">
              <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${kind === "pros" ? "text-sage-deep" : "text-terracotta"}`} />
              <span className="min-w-0 flex-1 wrap-break-word">{item}</span>
              <button
                type="button"
                aria-label={t("fields.removeNote", { note: item })}
                onClick={() => onChange(items.filter((_, position) => position !== index))}
                className="-my-0.5 rounded-full p-0.5 text-stone hover:text-terracotta"
              >
                <XIcon aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!full && (
        <div className="flex gap-2">
          <Input
            id={`venue-${kind}`}
            value={draft}
            maxLength={VENUE_LIMITS.noteItem}
            placeholder={t(`fields.${kind}Placeholder`)}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            // Un point saisi mais pas encore ajouté n'est pas perdu à l'enregistrement.
            onBlur={add}
            className="h-10 rounded-xl bg-card text-base"
          />
          <Button type="button" variant="outline" size="icon" className="size-10 shrink-0 rounded-full" aria-label={t(`fields.${kind}Add`)} onClick={add}>
            <PlusIcon aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}

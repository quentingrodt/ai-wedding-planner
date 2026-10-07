"use client";

import {
  BedDoubleIcon,
  UsersIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  ExternalLinkIcon,
  LightbulbIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GuestFamily } from "@/lib/guests/schema";
import { LODGING_STATUSES, SECURED_STATUSES, type LodgingStatus } from "@/lib/lodging/catalog";
import {
  assignedNeeds,
  bookingTimeline,
  groupLeverage,
  lodgingChecks,
  lodgingNeeds,
  securedRooms,
  sortLodgings,
  unassignedPeople,
  type LodgingCheck,
} from "@/lib/lodging/plan";
import type { Lodging, LodgingActionResult, LodgingGuest } from "@/lib/lodging/schema";
import { cn } from "@/lib/utils";
import { isoDateToUtc } from "@/lib/weddings/dates";
import { deleteLodging, setLodgingStatus } from "../actions";
import { AssignGuestsDialog } from "./assign-guests-dialog";
import { FarGuests } from "./far-guests";
import { LodgingDialog, type LodgingPreset } from "./lodging-dialog";
import { LodgingTips } from "./lodging-tips";

type AccommodationBoardProps = {
  guests: LodgingGuest[];
  families: GuestFamily[];
  lodgings: Lodging[];
  weddingDate: string | null;
  today: string;
  /** Réponse du questionnaire du rétroplanning, ou null s'il n'est pas rempli. */
  plannedLodging: boolean | null;
  /** Lieu retenu, s'il a des couchages sur place. */
  bookedVenue: { name: string; location: string | null; beds: number } | null;
  /** Devise du mariage (ISO 4217). */
  currency: string;
  /** Owner ou partner : la RLS refuse de toute façon l'écriture aux témoins. */
  canEdit: boolean;
};

const STATUS_SURFACE: Record<LodgingStatus, string> = {
  idea: "bg-linen text-stone",
  contacted: "bg-linen text-charcoal",
  option: "bg-terracotta-soft/70 text-terracotta",
  confirmed: "bg-sage-deep text-white",
  declined: "bg-linen text-stone",
};

/** Hébergement des invités : qui vient de loin, les astuces, puis les hébergements. */
export function AccommodationBoard({
  guests,
  families,
  lodgings,
  weddingDate,
  today,
  plannedLodging,
  bookedVenue,
  currency,
  canEdit,
}: AccommodationBoardProps) {
  const t = useTranslations("Lodging");
  const format = useFormatter();
  const locale = useLocale();
  const [, startTransition] = useTransition();
  // Fiche ouverte depuis une astuce ou le lieu retenu (key : une fiche neuve à chaque fois).
  const [draft, setDraft] = useState<{ key: number; preset: LodgingPreset } | null>(null);

  const money = (amount: number) =>
    format.number(amount, { style: "currency", currency, maximumFractionDigits: 0 });
  const currencySymbol =
    new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency;

  function run(action: () => Promise<LodgingActionResult>, success: string) {
    startTransition(async () => {
      const result = await action().catch((): LodgingActionResult => ({ ok: false, error: "generic" }));
      if (!result.ok) toast.error(t(`errors.${result.error}`));
      else toast(success);
    });
  }

  const openDraft = (preset: LodgingPreset) => setDraft((current) => ({ key: (current?.key ?? 0) + 1, preset }));

  const attending = guests.filter((guest) => guest.status !== "declined");
  const needs = lodgingNeeds(attending);
  const secured = securedRooms(lodgings);
  const sorted = sortLodgings(lodgings);
  const active = sorted.filter((lodging) => lodging.status !== "declined");
  const declined = sorted.filter((lodging) => lodging.status === "declined");
  // Invités à loger, et ceux déjà logés quelque part.
  const farGuests = attending.filter((guest) => guest.needs_lodging || guest.lodging_id !== null);
  const lodgingNames = new Map(lodgings.map((lodging) => [lodging.id, lodging.name]));
  const unassigned = unassignedPeople(attending);
  const assignment = { guests: farGuests, families, lodgingNames };
  const suggestVenue = canEdit && bookedVenue !== null && !lodgings.some((lodging) => lodging.kind === "venue");

  const summary =
    needs.people === 0
      ? t("far.summaryNone")
      : t("far.summary", { people: needs.people, rooms: needs.rooms });

  const addButton = canEdit && (
    <LodgingDialog
      lodging={null}
      currencySymbol={currencySymbol}
      trigger={
        <Button size="lg" className="h-11 rounded-full px-5">
          <PlusIcon aria-hidden />
          {t("add")}
        </Button>
      }
    />
  );

  return (
    <div className="flex flex-col gap-12">
      {draft && (
        <LodgingDialog
          key={draft.key}
          lodging={null}
          preset={draft.preset}
          currencySymbol={currencySymbol}
          open
          onOpenChange={(open) => !open && setDraft(null)}
        />
      )}

      {needs.people === 0 && plannedLodging === false && (
        <p className="rounded-3xl bg-linen px-6 py-5 text-stone">{t("plannedNo")}</p>
      )}

      <FarGuests
        guests={attending}
        families={families}
        canEdit={canEdit}
        defaultOpen={needs.people === 0}
        summary={summary}
        lodgingNames={lodgingNames}
      />

      {needs.people === 0 && lodgings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-linen px-6 py-12 text-center">
          <BedDoubleIcon aria-hidden className="size-8 text-sand" strokeWidth={1.5} />
          <p className="max-w-md font-serif text-2xl text-balance">{t("empty.title")}</p>
          <p className="max-w-md text-stone">{t("empty.body")}</p>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3">
            {([
              { key: "people", value: format.number(needs.people), surface: "bg-linen" },
              { key: "rooms", value: format.number(needs.rooms), surface: "bg-terracotta-soft/60" },
              { key: "secured", value: format.number(secured), surface: "bg-sage-soft" },
            ] as const).map(({ key, value, surface }) => (
              <div key={key} className={`flex min-w-0 flex-col-reverse gap-1 rounded-3xl px-4 py-4 sm:px-5 ${surface}`}>
                <dt className="text-sm text-stone">{t(`kpis.${key}`)}</dt>
                <dd className="font-serif text-2xl text-charcoal tabular-nums sm:text-3xl">{value}</dd>
              </div>
            ))}
          </dl>
          {needs.rooms > 0 && (
            <div className="-mt-8 flex flex-col gap-1.5">
              <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-linen">
                <div
                  className="h-full rounded-full bg-sage"
                  style={{ width: `${Math.min(1, secured / needs.rooms) * 100}%` }}
                />
              </div>
              <p className="text-sm text-stone">
                {secured >= needs.rooms
                  ? t("coverage.done")
                  : t("coverage.missing", { count: needs.rooms - secured })}
                {lodgings.length > 0 &&
                  " " + (unassigned > 0 ? t("coverage.unassigned", { count: unassigned }) : t("coverage.allAssigned"))}
              </p>
            </div>
          )}

          {needs.people > 0 && (
            <LodgingTips
              timeline={bookingTimeline(weddingDate, today)}
              leverage={groupLeverage(needs.rooms)}
              rooms={needs.rooms}
              onAdd={canEdit ? (kind) => openDraft({ kind }) : undefined}
            />
          )}

          <section aria-labelledby="lodgings-title" className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2 id="lodgings-title" className="font-serif text-3xl">{t("list.title")}</h2>
                <p className="text-stone">{t("list.lead")}</p>
                <p className="text-sm text-stone">{t("list.shared")}</p>
              </div>
              {addButton}
            </div>

            {suggestVenue && bookedVenue && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-sage-soft px-6 py-5">
                <p className="text-charcoal">{t("venueSuggestion.body", { name: bookedVenue.name, count: bookedVenue.beds })}</p>
                <Button
                  variant="outline"
                  className="h-10 rounded-full bg-card px-4"
                  onClick={() => openDraft({ name: bookedVenue.name, kind: "venue", location: bookedVenue.location })}
                >
                  <PlusIcon aria-hidden />
                  {t("venueSuggestion.add")}
                </Button>
              </div>
            )}

            {active.length === 0 ? (
              <p className="rounded-3xl bg-linen px-6 py-10 text-center text-stone">{t("list.empty")}</p>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {active.map((lodging) => (
                  <LodgingCard
                    key={lodging.id}
                    lodging={lodging}
                    today={today}
                    currencySymbol={currencySymbol}
                    money={money}
                    canEdit={canEdit}
                    run={run}
                    {...assignment}
                  />
                ))}
              </ul>
            )}

            {declined.length > 0 && (
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-stone [&::-webkit-details-marker]:hidden">
                  <ChevronDownIcon aria-hidden className="size-4 transition-transform group-open:rotate-180" />
                  {t("list.declined", { count: declined.length })}
                </summary>
                <ul className="mt-4 grid gap-4 md:grid-cols-2">
                  {declined.map((lodging) => (
                    <LodgingCard
                      key={lodging.id}
                      lodging={lodging}
                      today={today}
                      currencySymbol={currencySymbol}
                      money={money}
                      canEdit={canEdit}
                      run={run}
                      {...assignment}
                    />
                  ))}
                </ul>
              </details>
            )}
          </section>
        </>
      )}
    </div>
  );
}

type CardProps = {
  lodging: Lodging;
  today: string;
  currencySymbol: string;
  money: (amount: number) => string;
  canEdit: boolean;
  run: (action: () => Promise<LodgingActionResult>, success: string) => void;
  /** Invités venant de loin ou déjà logés, pour l'attribution. */
  guests: LodgingGuest[];
  families: GuestFamily[];
  lodgingNames: Map<string, string>;
};

function LodgingCard({ lodging, today, currencySymbol, money, canEdit, run, guests, families, lodgingNames }: CardProps) {
  const t = useTranslations("Lodging");
  const format = useFormatter();
  const residents = guests.filter((guest) => guest.lodging_id === lodging.id);
  const checks = lodgingChecks(lodging, today, assignedNeeds(guests, lodging.id).rooms);
  const date = (iso: string) =>
    format.dateTime(isoDateToUtc(iso), { day: "numeric", month: "long", timeZone: "UTC" });

  const facts = [
    lodging.rooms !== null && t("facts.rooms", { count: lodging.rooms }),
    lodging.price_per_night !== null && t("facts.perNight", { price: money(lodging.price_per_night) }),
    lodging.travel_minutes !== null && t("facts.travel", { minutes: lodging.travel_minutes }),
  ].filter((fact): fact is string => typeof fact === "string");

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-3xl bg-card p-5 ring-1 ring-border sm:p-6",
        lodging.status === "declined" && "opacity-75",
      )}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_SURFACE[lodging.status]}`}>
            {t(`statuses.${lodging.status}`)}
          </span>
          <span className="text-xs text-stone">{t(`kinds.${lodging.kind}`)}</span>
          {((SECURED_STATUSES.includes(lodging.status) && lodging.kind !== "family") || residents.length > 0) && (
            <span className="rounded-full bg-linen px-2.5 py-0.5 text-xs text-charcoal">{t("facts.shared")}</span>
          )}
          {lodging.group_rate && (
            <span className="rounded-full bg-sage-soft px-2.5 py-0.5 text-xs text-sage-deep">{t("facts.groupRate")}</span>
          )}
        </div>
        <h3 className="font-serif text-2xl leading-snug wrap-break-word">{lodging.name}</h3>
        {lodging.location && (
          <p className="flex items-center gap-1.5 text-sm text-stone">
            <MapPinIcon aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{lodging.location}</span>
          </p>
        )}
      </div>

      {facts.length > 0 && <p className="text-sm text-charcoal">{facts.join(" · ")}</p>}
      {lodging.booking_code && (
        <p className="text-sm text-charcoal">
          {t("facts.code")} <span className="rounded-md bg-linen px-1.5 py-0.5 font-medium">{lodging.booking_code}</span>
        </p>
      )}
      {lodging.deadline && (
        <p className="text-sm text-stone">{t("facts.deadline", { date: date(lodging.deadline) })}</p>
      )}
      {lodging.contact && <p className="text-sm text-stone">{lodging.contact}</p>}

      {checks.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {checks.map((check) => (
            <li
              key={check.key}
              className={cn("flex items-start gap-2 text-sm", check.tone === "watch" ? "text-terracotta" : "text-sage-deep")}
            >
              {check.tone === "watch" ? (
                <CircleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
              ) : (
                <LightbulbIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
              )}
              <span>{checkLabel(t, check)}</span>
            </li>
          ))}
        </ul>
      )}

      {residents.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-2xl bg-linen/70 p-3">
          <p className="text-xs font-medium tracking-[0.15em] text-stone uppercase">
            {t("assign.residents", { count: residents.length })}
          </p>
          <p className="text-sm leading-6">
            {format.list(residents.map((guest) => [guest.first_name, guest.last_name].filter(Boolean).join(" ")))}
          </p>
        </div>
      )}

      {lodging.notes && <p className="text-sm leading-6 text-pretty text-stone">{lodging.notes}</p>}

      {(canEdit || lodging.url) && (
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="rounded-full text-stone">
                  {t("status.change")}
                  <ChevronDownIcon aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 rounded-2xl p-1.5">
                {LODGING_STATUSES.filter((status) => status !== lodging.status).map((status) => (
                  <DropdownMenuItem
                    key={status}
                    className="h-9 rounded-xl px-2.5"
                    onSelect={() =>
                      run(
                        () => setLodgingStatus(lodging.id, status),
                        t("status.changed", { name: lodging.name, status: t(`statuses.${status}`) }),
                      )
                    }
                  >
                    {t(`statuses.${status}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canEdit && lodging.status !== "declined" && (
            <AssignGuestsDialog
              lodging={lodging}
              guests={guests}
              families={families}
              lodgingNames={lodgingNames}
              trigger={
                <Button variant="outline" size="sm" className="rounded-full">
                  <UsersIcon aria-hidden />
                  {t("assign.open")}
                </Button>
              }
            />
          )}
          <span className="ml-auto flex">
            {lodging.url && (
              <Button variant="ghost" size="icon-sm" asChild className="text-stone">
                <a href={lodging.url} target="_blank" rel="noopener noreferrer" aria-label={t("site", { name: lodging.name })}>
                  <ExternalLinkIcon aria-hidden />
                </a>
              </Button>
            )}
            {canEdit && (
              <>
                <LodgingDialog
                  lodging={lodging}
                  currencySymbol={currencySymbol}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={t("editLabel", { name: lodging.name })} className="text-stone">
                      <PencilIcon aria-hidden />
                    </Button>
                  }
                />
                <ConfirmDelete
                  name={lodging.name}
                  onConfirm={() => run(() => deleteLodging(lodging.id), t("deleted", { name: lodging.name }))}
                />
              </>
            )}
          </span>
        </div>
      )}
    </li>
  );
}

function checkLabel(t: ReturnType<typeof useTranslations<"Lodging">>, check: LodgingCheck) {
  switch (check.key) {
    case "deadlineSoon":
      return t("checks.deadlineSoon", { count: check.days });
    case "tooFewRooms":
      return t("checks.tooFewRooms", { count: check.missing });
    case "shuttle":
      return t("checks.shuttle", { minutes: check.minutes });
    default:
      return t(`checks.${check.key}`);
  }
}

function ConfirmDelete({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const t = useTranslations("Lodging");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("deleteLabel", { name })} className="text-stone hover:text-terracotta">
          <Trash2Icon aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-xl">{t("deleteTitle", { name })}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

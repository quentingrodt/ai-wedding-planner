"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  ExternalLinkIcon,
  HeartIcon,
  MapPinIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
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
import { RATING_MAX, VENUE_CRITERIA, type VenueCriterion, type VenueStatus } from "@/lib/venues/catalog";
import {
  bestRatings,
  sortVenues,
  venueChecks,
  venueScore,
  type VenueCheck,
  type VenueContext,
} from "@/lib/venues/compare";
import { EDITABLE_STATUSES, ratingOf, type Venue, type VenueActionResult } from "@/lib/venues/schema";
import { cn } from "@/lib/utils";
import { chooseVenue, deleteVenue, setVenueStatus } from "../actions";
import { RatingDots } from "./rating";
import { VenueDialog } from "./venue-dialog";

type VenuesBoardProps = {
  venues: Venue[];
  context: VenueContext;
  /** Devise du mariage (ISO 4217). */
  currency: string;
};

const STATUS_SURFACE: Record<VenueStatus, string> = {
  idea: "bg-linen text-stone",
  contacted: "bg-linen text-charcoal",
  visited: "bg-sand/70 text-charcoal",
  shortlisted: "bg-terracotta-soft/70 text-terracotta",
  booked: "bg-sage-deep text-white",
  declined: "bg-linen text-stone",
};

/** Lieux de réception : repères du mariage, critères, fiches des lieux et comparatif. */
export function VenuesBoard({ venues, context, currency }: VenuesBoardProps) {
  const t = useTranslations("Venues");
  const format = useFormatter();
  const locale = useLocale();
  const [, startTransition] = useTransition();

  const money = (amount: number) =>
    format.number(amount, { style: "currency", currency, maximumFractionDigits: 0 });
  const currencySymbol =
    new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency;

  function run(action: () => Promise<VenueActionResult>, success: string) {
    startTransition(async () => {
      const result = await action().catch((): VenueActionResult => ({ ok: false, error: "generic" }));
      if (!result.ok) toast.error(t(`errors.${result.error}`));
      else toast(success);
    });
  }

  const sorted = sortVenues(venues);
  const active = sorted.filter((venue) => venue.status !== "declined");
  const declined = sorted.filter((venue) => venue.status === "declined");
  const booked = venues.find((venue) => venue.status === "booked") ?? null;
  const shortlisted = active.filter((venue) => venue.status === "shortlisted" || venue.status === "booked");
  // Le comparatif porte sur la short-list dès qu'elle compte deux lieux, sinon sur tous les lieux en lice.
  const compared = shortlisted.length >= 2 ? shortlisted : active;

  const addButton = (
    <VenueDialog
      venue={null}
      currencySymbol={currencySymbol}
      trigger={
        <Button size="lg" className="h-11 rounded-full px-5">
          <PlusIcon aria-hidden />
          {t("add")}
        </Button>
      }
    />
  );

  const cardProps = { context, money, run };

  return (
    <div className="flex flex-col gap-12">
      {/* Les repères tirés du mariage, auxquels chaque lieu est confronté. */}
      <dl className="grid grid-cols-3 gap-3">
        {([
          {
            key: "guests",
            value: context.guestCount !== null ? format.number(context.guestCount) : "—",
            surface: "bg-linen",
          },
          {
            key: "budget",
            value: context.venueBudget !== null ? money(context.venueBudget) : "—",
            surface: "bg-sage-soft",
          },
          {
            key: "style",
            value: context.ambiance ? t(`styles.${context.ambiance as "chateau"}`) : "—",
            surface: "bg-terracotta-soft/60",
          },
        ] as const).map(({ key, value, surface }) => (
          <div key={key} className={`flex min-w-0 flex-col-reverse gap-1 rounded-3xl px-4 py-4 sm:px-5 ${surface}`}>
            <dt className="text-sm text-stone">{t(`benchmarks.${key}`)}</dt>
            <dd className="truncate font-serif text-2xl text-charcoal tabular-nums sm:text-3xl">{value}</dd>
          </div>
        ))}
      </dl>

      {booked && (
        <section className="flex flex-col gap-2 rounded-3xl bg-sage-deep px-6 py-6 text-white">
          <p className="text-xs font-medium tracking-[0.2em] uppercase opacity-80">{t("booked.eyebrow")}</p>
          <p className="font-serif text-3xl text-balance">{booked.name}</p>
          <p className="opacity-90">{t("booked.body")}</p>
        </section>
      )}

      <CriteriaGuide />

      <section aria-labelledby="venues-title" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="venues-title" className="font-serif text-3xl">{t("list.title")}</h2>
            <p className="text-stone">{t("list.lead")}</p>
          </div>
          {venues.length > 0 && addButton}
        </div>

        {venues.length === 0 ? (
          <div className="flex flex-col items-center gap-5 rounded-3xl bg-linen px-6 py-14 text-center">
            <p className="max-w-md font-serif text-2xl text-balance">{t("empty.title")}</p>
            <p className="max-w-md text-stone">{t("empty.body")}</p>
            {addButton}
          </div>
        ) : active.length === 0 ? (
          <p className="rounded-3xl bg-linen px-6 py-10 text-center text-stone">{t("list.allDeclined")}</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {active.map((venue) => (
              <VenueCard key={venue.id} venue={venue} currencySymbol={currencySymbol} {...cardProps} />
            ))}
          </ul>
        )}
      </section>

      {compared.length >= 2 && <CompareTable venues={compared} money={money} />}

      {declined.length > 0 && (
        <details className="group flex flex-col gap-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-stone [&::-webkit-details-marker]:hidden">
            <ChevronDownIcon aria-hidden className="size-4 transition-transform group-open:rotate-180" />
            {t("list.declined", { count: declined.length })}
          </summary>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {declined.map((venue) => (
              <VenueCard key={venue.id} venue={venue} currencySymbol={currencySymbol} {...cardProps} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Les huit critères, avec les questions à poser au lieu. */
function CriteriaGuide() {
  const t = useTranslations("Venues");
  return (
    <details className="group rounded-3xl bg-card ring-1 ring-border">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-6 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col gap-1">
          <span className="font-serif text-2xl">{t("guide.title")}</span>
          <span className="text-stone">{t("guide.lead")}</span>
        </span>
        <ChevronDownIcon aria-hidden className="mt-2 size-5 shrink-0 text-stone transition-transform group-open:rotate-180" />
      </summary>
      <ol className="grid gap-x-8 gap-y-6 px-6 pb-6 sm:grid-cols-2">
        {VENUE_CRITERIA.map((criterion, index) => (
          <li key={criterion} className="flex gap-4">
            <span className="font-serif text-2xl leading-none text-terracotta tabular-nums">{index + 1}</span>
            <div className="flex flex-col gap-1">
              <p className="font-medium">{t(`criteria.${criterion}.label`)}</p>
              <p className="text-sm leading-6 text-stone">{t(`criteria.${criterion}.questions`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}

type CardProps = {
  venue: Venue;
  context: VenueContext;
  currencySymbol: string;
  money: (amount: number) => string;
  run: (action: () => Promise<VenueActionResult>, success: string) => void;
};

function VenueCard({ venue, context, currencySymbol, money, run }: CardProps) {
  const t = useTranslations("Venues");
  const format = useFormatter();
  const { score, rated } = venueScore(venue);
  const checks = venueChecks(venue, context);

  const facts = [
    venue.capacity !== null && t("facts.capacity", { count: venue.capacity }),
    venue.price !== null && money(venue.price),
    venue.beds !== null && t("facts.beds", { count: venue.beds }),
    venue.travel_minutes !== null && t("facts.travel", { minutes: venue.travel_minutes }),
  ].filter((fact): fact is string => typeof fact === "string");

  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-border sm:p-6",
        venue.status === "booked" && "ring-2 ring-sage-deep",
        venue.status === "declined" && "opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_SURFACE[venue.status]}`}>
            {t(`statuses.${venue.status}`)}
          </span>
          <h3 className="font-serif text-2xl leading-snug wrap-break-word">{venue.name}</h3>
          {venue.location && (
            <p className="flex items-center gap-1.5 text-sm text-stone">
              <MapPinIcon aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{venue.location}</span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <span className="font-serif text-3xl leading-none text-charcoal tabular-nums">
            {score !== null ? format.number(score, { maximumFractionDigits: 1 }) : "—"}
            <span className="text-base text-stone">/{RATING_MAX}</span>
          </span>
          <span className="text-xs text-stone">{t("score.rated", { count: rated, total: VENUE_CRITERIA.length })}</span>
        </div>
      </div>

      {facts.length > 0 && <p className="text-sm text-charcoal">{facts.join(" · ")}</p>}

      {checks.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {checks.map((check) => (
            <li
              key={check.key}
              className={cn(
                "flex items-start gap-2 text-sm",
                check.tone === "good" ? "text-sage-deep" : "text-terracotta",
              )}
            >
              {check.tone === "good" ? (
                <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
              ) : (
                <CircleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
              )}
              <span>{checkLabel(t, check, money)}</span>
            </li>
          ))}
        </ul>
      )}

      {(venue.pros.length > 0 || venue.cons.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <NoteList items={venue.pros} kind="pros" />
          <NoteList items={venue.cons} kind="cons" />
        </div>
      )}

      {venue.notes && <p className="text-sm leading-6 text-pretty text-stone">{venue.notes}</p>}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {venue.status !== "booked" && venue.status !== "declined" && (
          <ChooseButton venue={venue} onConfirm={() => run(() => chooseVenue(venue.id), t("choose.done", { name: venue.name }))} />
        )}
        {venue.status === "declined" && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => run(() => setVenueStatus(venue.id, "visited"), t("status.restored", { name: venue.name }))}
          >
            {t("status.restore")}
          </Button>
        )}
        {venue.status !== "declined" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="rounded-full text-stone">
                {t("status.change")}
                <ChevronDownIcon aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 rounded-2xl p-1.5">
              {EDITABLE_STATUSES.filter((status) => status !== venue.status).map((status) => (
                <DropdownMenuItem
                  key={status}
                  className="h-9 rounded-xl px-2.5"
                  onSelect={() =>
                    run(() => setVenueStatus(venue.id, status), t("status.changed", { name: venue.name, status: t(`statuses.${status}`) }))
                  }
                >
                  {t(`statuses.${status}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <span className="ml-auto flex">
          {venue.url && (
            <Button variant="ghost" size="icon-sm" asChild className="text-stone">
              <a href={venue.url} target="_blank" rel="noopener noreferrer" aria-label={t("site", { name: venue.name })}>
                <ExternalLinkIcon aria-hidden />
              </a>
            </Button>
          )}
          <VenueDialog
            venue={venue}
            currencySymbol={currencySymbol}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={t("editLabel", { name: venue.name })} className="text-stone">
                <PencilIcon aria-hidden />
              </Button>
            }
          />
          <ConfirmDelete venue={venue} onConfirm={() => run(() => deleteVenue(venue.id), t("deleted", { name: venue.name }))} />
        </span>
      </div>
    </li>
  );
}

function checkLabel(
  t: ReturnType<typeof useTranslations<"Venues">>,
  check: VenueCheck,
  money: (amount: number) => string,
) {
  switch (check.key) {
    case "fits":
      return t("checks.fits", { count: check.spare });
    case "tooSmall":
      return t("checks.tooSmall", { count: check.missing });
    case "withinBudget":
      return t("checks.withinBudget", { amount: money(check.left) });
    case "overBudget":
      return t("checks.overBudget", { amount: money(check.over) });
    case "earlyCurfew":
      return t("checks.earlyCurfew", { time: check.time });
    default:
      return t(`checks.${check.key}`);
  }
}

function NoteList({ items, kind }: { items: string[]; kind: "pros" | "cons" }) {
  const t = useTranslations("Venues");
  if (items.length === 0) return null;
  const Icon = kind === "pros" ? PlusIcon : MinusIcon;
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-linen/70 p-3">
      <p className="text-xs font-medium tracking-[0.15em] text-stone uppercase">{t(`fields.${kind}`)}</p>
      <ul className="flex flex-col gap-1">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex items-start gap-1.5 text-sm leading-5">
            <Icon aria-hidden className={`mt-0.5 size-3.5 shrink-0 ${kind === "pros" ? "text-sage-deep" : "text-terracotta"}`} />
            <span className="min-w-0 wrap-break-word">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Tableau côte à côte : un lieu par colonne, un critère par ligne, la meilleure note soulignée. */
function CompareTable({ venues, money }: { venues: Venue[]; money: (amount: number) => string }) {
  const t = useTranslations("Venues");
  const format = useFormatter();
  const best = bestRatings(venues);

  const fact = (venue: Venue, criterion: VenueCriterion): string | null => {
    switch (criterion) {
      case "location":
        return [venue.location, venue.travel_minutes !== null && t("facts.travel", { minutes: venue.travel_minutes })]
          .filter((part): part is string => typeof part === "string" && part !== "")
          .join(" · ") || null;
      case "capacity":
        return venue.capacity !== null ? t("facts.capacity", { count: venue.capacity }) : null;
      case "budget":
        return venue.price !== null ? money(venue.price) : null;
      case "style":
        return venue.style ? t(`styles.${venue.style}`) : null;
      case "accommodation":
        return venue.beds !== null ? t("facts.beds", { count: venue.beds }) : venue.accommodation_note;
      case "service":
        return venue.catering ? t(`caterings.${venue.catering}`) : null;
      case "restrictions":
        return venue.curfew ? t("facts.curfew", { time: venue.curfew.slice(0, 5) }) : venue.restrictions;
      case "flexibility":
        return venue.date_status ? t(`dateStatuses.${venue.date_status}`) : null;
    }
  };

  return (
    <section aria-labelledby="compare-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="compare-title" className="font-serif text-3xl">{t("compare.title")}</h2>
        <p className="text-stone">{t("compare.lead")}</p>
      </div>
      <div className="overflow-x-auto rounded-3xl bg-card ring-1 ring-border">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="w-40 p-4 text-left text-xs font-medium tracking-[0.15em] text-stone uppercase">
                {t("compare.criterion")}
              </th>
              {venues.map((venue) => (
                <th key={venue.id} scope="col" className="p-4 text-left align-bottom">
                  <span className="flex items-center gap-1.5 font-serif text-lg leading-snug font-normal">
                    {venue.status === "booked" && <HeartIcon aria-hidden className="size-4 shrink-0 fill-sage-deep text-sage-deep" />}
                    {venue.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VENUE_CRITERIA.map((criterion) => (
              <tr key={criterion} className="border-b border-border last:border-b-0">
                <th scope="row" className="p-4 text-left align-top font-medium">{t(`criteria.${criterion}.label`)}</th>
                {venues.map((venue) => {
                  const rating = ratingOf(venue, criterion);
                  const isBest = rating !== null && rating === best[criterion] && venues.length > 1;
                  return (
                    <td key={venue.id} className={cn("p-4 align-top", isBest && "bg-sage-soft/60")}>
                      <div className="flex flex-col gap-1.5">
                        <RatingDots value={rating} />
                        {fact(venue, criterion) && <span className="text-stone">{fact(venue, criterion)}</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="bg-linen/60">
              <th scope="row" className="p-4 text-left font-serif text-lg font-normal">{t("compare.overall")}</th>
              {venues.map((venue) => {
                const { score } = venueScore(venue);
                return (
                  <td key={venue.id} className="p-4 font-serif text-2xl tabular-nums">
                    {score !== null ? format.number(score, { maximumFractionDigits: 1 }) : "—"}
                    <span className="text-sm text-stone">/{RATING_MAX}</span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ChooseButton({ venue, onConfirm }: { venue: Venue; onConfirm: () => void }) {
  const t = useTranslations("Venues");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" className="rounded-full px-4">
          <HeartIcon aria-hidden />
          {t("choose.action")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-xl">{t("choose.title", { name: venue.name })}</AlertDialogTitle>
          <AlertDialogDescription>{t("choose.description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t("choose.confirm")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConfirmDelete({ venue, onConfirm }: { venue: Venue; onConfirm: () => void }) {
  const t = useTranslations("Venues");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("deleteLabel", { name: venue.name })} className="text-stone hover:text-terracotta">
          <Trash2Icon aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-xl">{t("deleteTitle", { name: venue.name })}</AlertDialogTitle>
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

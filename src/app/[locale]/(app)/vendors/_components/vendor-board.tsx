"use client";

import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  ExternalLinkIcon,
  HeartIcon,
  LightbulbIcon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { NoteList } from "@/components/compare/note-list-field";
import { RatingDots } from "@/components/compare/rating";
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
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { VENDOR_CATALOG, VENDOR_STATUSES, type VendorCategory, type VendorStatus } from "@/lib/vendors/catalog";
import { sortVendors, vendorChecks, vendorTotal, type VendorCheck } from "@/lib/vendors/plan";
import type { Vendor, VendorActionResult } from "@/lib/vendors/schema";
import type { VenueCatering } from "@/lib/venues/catalog";
import { isoDateToUtc } from "@/lib/weddings/dates";
import { deleteVendor, setVendorStatus } from "../actions";
import { DETAIL_FIELDS, QUESTION_COUNTS } from "@/lib/vendors/details";
import { paymentSummary } from "@/lib/vendors/payments";
import { VendorDialog } from "./vendor-dialog";

type VendorBoardProps = {
  category: VendorCategory;
  vendors: Vendor[];
  /** Invités attendus, pour les prix par invité. */
  guestCount: number | null;
  /** Montant prévu au budget pour le poste de la catégorie. */
  envelope: number | null;
  /** Traiteur du lieu retenu (page Traiteur uniquement). */
  venueCatering: VenueCatering | null;
  /** Carnet de la catégorie (menu, préparatifs, mensurations…), s'il y en a un. */
  tools?: ReactNode;
  today: string;
  /** Devise du mariage (ISO 4217). */
  currency: string;
};

const STATUS_SURFACE: Record<VendorStatus, string> = {
  idea: "bg-linen text-stone",
  contacted: "bg-linen text-charcoal",
  quote: "bg-sand/70 text-charcoal",
  meeting: "bg-terracotta-soft/70 text-terracotta",
  booked: "bg-sage-deep text-white",
  declined: "bg-linen text-stone",
};

/** Une catégorie de prestataires : le guide, les repères, puis les pistes. */
export function VendorBoard({
  category,
  vendors,
  guestCount,
  envelope,
  venueCatering,
  tools,
  today,
  currency,
}: VendorBoardProps) {
  const t = useTranslations("Vendors");
  const format = useFormatter();
  const locale = useLocale();
  const [, startTransition] = useTransition();
  const definition = VENDOR_CATALOG[category];

  const money = (amount: number) =>
    format.number(amount, { style: "currency", currency, maximumFractionDigits: 0 });
  const currencySymbol =
    new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency;

  function run(action: () => Promise<VendorActionResult>, success: string) {
    startTransition(async () => {
      const result = await action().catch((): VendorActionResult => ({ ok: false, error: "generic" }));
      if (!result.ok) toast.error(t(`errors.${result.error}`));
      else toast(success);
    });
  }

  const sorted = sortVendors(vendors);
  const active = sorted.filter((vendor) => vendor.status !== "declined");
  const declined = sorted.filter((vendor) => vendor.status === "declined");
  const booked = vendors.filter((vendor) => vendor.status === "booked");
  const bookedTotal = booked.reduce((sum, vendor) => sum + (vendorTotal(vendor, guestCount) ?? 0), 0);

  const addButton = (
    <VendorDialog
      category={category}
      vendor={null}
      currencySymbol={currencySymbol}
      guestCount={guestCount}
      trigger={
        <Button size="lg" className="h-11 rounded-full px-5">
          <PlusIcon aria-hidden />
          {t("add")}
        </Button>
      }
    />
  );
  const cardProps = { guestCount, envelope, today, currencySymbol, money, run };

  return (
    <div className="flex flex-col gap-12">
      <dl className="grid grid-cols-3 gap-3">
        {([
          {
            key: "envelope",
            label: t("benchmarks.envelope", { line: t(`budgetLines.${definition.budget}`) }),
            value: envelope !== null ? money(envelope) : "—",
            surface: "bg-sage-soft",
          },
          {
            key: "guests",
            label: t("benchmarks.guests"),
            value: guestCount !== null ? format.number(guestCount) : "—",
            surface: "bg-linen",
          },
          {
            key: "booked",
            label: t("benchmarks.booked"),
            value: booked.length > 0 ? money(bookedTotal) : "—",
            surface: "bg-terracotta-soft/60",
          },
        ] as const).map(({ key, label, value, surface }) => (
          <div key={key} className={`flex min-w-0 flex-col-reverse gap-1 rounded-3xl px-4 py-4 sm:px-5 ${surface}`}>
            <dt className="text-sm text-stone">{label}</dt>
            <dd className="truncate font-serif text-2xl text-charcoal tabular-nums sm:text-3xl">{value}</dd>
          </div>
        ))}
      </dl>

      {category === "catering" && (venueCatering === "imposed" || venueCatering === "included") && (
        <p className="rounded-3xl bg-terracotta-soft/40 px-6 py-5 text-charcoal">{t(`venueCatering.${venueCatering}`)}</p>
      )}

      <details className="group rounded-3xl bg-card ring-1 ring-border" open={vendors.length === 0}>
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-6 [&::-webkit-details-marker]:hidden">
          <span className="flex flex-col gap-1">
            <span className="font-serif text-2xl">{t("guide.title")}</span>
            <span className="text-stone">{t(`categories.${category}.when`)}</span>
          </span>
          <ChevronDownIcon aria-hidden className="mt-2 size-5 shrink-0 text-stone transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-4 px-6 pb-6">
          <p className="text-xs font-medium tracking-[0.15em] text-stone uppercase">{t("guide.questions")}</p>
          <ul className="flex flex-col gap-2">
            {t(`categories.${category}.questions`)
              .split("|")
              .map((question) => (
                <li key={question} className="flex gap-3 leading-6">
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-terracotta" />
                  {question}
                </li>
              ))}
          </ul>
          {t(`categories.${category}.tips`) !== "" && (
            <>
              <p className="pt-2 text-xs font-medium tracking-[0.15em] text-stone uppercase">{t("guide.tips")}</p>
              <ul className="flex flex-col gap-2">
                {t(`categories.${category}.tips`)
                  .split("|")
                  .map((tip) => (
                    <li key={tip} className="flex gap-3 leading-6 text-stone">
                      <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-sage" />
                      {tip}
                    </li>
                  ))}
              </ul>
            </>
          )}
          {definition.link && (
            <Link
              href={definition.link}
              className="inline-flex w-fit items-center gap-2 text-sm text-sage-deep underline decoration-sage/40 underline-offset-4 hover:decoration-sage-deep"
            >
              {t(`links.${category as "catering"}`)}
              <ArrowRightIcon aria-hidden className="size-3.5" />
            </Link>
          )}
        </div>
      </details>

      {tools}

      <section aria-labelledby="vendors-title" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="vendors-title" className="font-serif text-3xl">{t("list.title")}</h2>
            <p className="text-stone">{t("list.lead")}</p>
          </div>
          {vendors.length > 0 && addButton}
        </div>

        {vendors.length === 0 ? (
          <div className="flex flex-col items-center gap-5 rounded-3xl bg-linen px-6 py-12 text-center">
            <p className="max-w-md font-serif text-2xl text-balance">{t("empty.title")}</p>
            <p className="max-w-md text-stone">{t("empty.body")}</p>
            {addButton}
          </div>
        ) : active.length === 0 ? (
          <p className="rounded-3xl bg-linen px-6 py-10 text-center text-stone">{t("list.allDeclined")}</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {active.map((vendor) => (
              <VendorCard key={vendor.id} vendor={vendor} {...cardProps} />
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
              {declined.map((vendor) => (
                <VendorCard key={vendor.id} vendor={vendor} {...cardProps} />
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

type CardProps = {
  vendor: Vendor;
  guestCount: number | null;
  envelope: number | null;
  today: string;
  currencySymbol: string;
  money: (amount: number) => string;
  run: (action: () => Promise<VendorActionResult>, success: string) => void;
};

function VendorCard({ vendor, guestCount, envelope, today, currencySymbol, money, run }: CardProps) {
  const t = useTranslations("Vendors");
  const format = useFormatter();
  const checks = vendorChecks(vendor, { guestCount, envelope, today });
  const total = vendorTotal(vendor, guestCount);
  const date = (iso: string) =>
    format.dateTime(isoDateToUtc(iso), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-3xl bg-card p-5 ring-1 ring-border sm:p-6",
        vendor.status === "booked" && "ring-2 ring-sage-deep",
        vendor.status === "declined" && "opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_SURFACE[vendor.status]}`}>
            {t(`statuses.${vendor.status}`)}
          </span>
          <h3 className="font-serif text-2xl leading-snug wrap-break-word">{vendor.name}</h3>
          {vendor.location && (
            <p className="flex items-center gap-1.5 text-sm text-stone">
              <MapPinIcon aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{vendor.location}</span>
            </p>
          )}
        </div>
        <RatingDots value={vendor.rating} className="mt-1 shrink-0" />
      </div>

      {vendor.price !== null && (
        <p className="text-sm text-charcoal">
          {vendor.price_basis === "per_guest" ? (
            <>
              {t("price.perGuest", { price: money(vendor.price) })}
              {total !== null && guestCount !== null && (
                <span className="text-stone"> · {t("price.estimate", { total: money(total), count: guestCount })}</span>
              )}
            </>
          ) : (
            money(vendor.price)
          )}
        </p>
      )}
      <PaymentLine vendor={vendor} guestCount={guestCount} money={money} />
      <DetailChips vendor={vendor} />
      {vendor.meeting_date && vendor.meeting_date >= today && (
        <p className="flex items-center gap-1.5 text-sm text-charcoal">
          <CalendarIcon aria-hidden className="size-3.5 shrink-0 text-stone" />
          {t("meeting", { date: date(vendor.meeting_date) })}
        </p>
      )}
      {(vendor.contact_name || vendor.phone || vendor.email) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone">
          {vendor.contact_name && <span>{vendor.contact_name}</span>}
          {vendor.phone && (
            <a href={`tel:${vendor.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 hover:text-charcoal">
              <PhoneIcon aria-hidden className="size-3.5" />
              {vendor.phone}
            </a>
          )}
          {vendor.email && (
            <a href={`mailto:${vendor.email}`} className="inline-flex min-w-0 items-center gap-1 hover:text-charcoal">
              <MailIcon aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{vendor.email}</span>
            </a>
          )}
        </div>
      )}

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
              <span>{checkLabel(t, check, money)}</span>
            </li>
          ))}
        </ul>
      )}

      {(vendor.pros.length > 0 || vendor.cons.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <NoteList items={vendor.pros} kind="pros" />
          <NoteList items={vendor.cons} kind="cons" />
        </div>
      )}

      {vendor.notes && <p className="text-sm leading-6 text-pretty text-stone">{vendor.notes}</p>}

      {(vendor.details.asked?.length ?? 0) > 0 && (
        <p className="text-xs text-stone">
          {t("questionsUi.progress", { count: vendor.details.asked?.length ?? 0, total: QUESTION_COUNTS[vendor.category] })}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {vendor.status !== "booked" && vendor.status !== "declined" && (
          <Button
            size="sm"
            className="rounded-full px-4"
            onClick={() => run(() => setVendorStatus(vendor.id, "booked"), t("bookedToast", { name: vendor.name }))}
          >
            <HeartIcon aria-hidden />
            {t("book")}
          </Button>
        )}
        {vendor.status === "booked" && (
          <span className="inline-flex items-center gap-1 text-sm text-sage-deep">
            <CheckIcon aria-hidden className="size-4" />
            {t("statuses.booked")}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="rounded-full text-stone">
              {t("status.change")}
              <ChevronDownIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 rounded-2xl p-1.5">
            {VENDOR_STATUSES.filter((status) => status !== vendor.status).map((status) => (
              <DropdownMenuItem
                key={status}
                className="h-9 rounded-xl px-2.5"
                onSelect={() =>
                  run(
                    () => setVendorStatus(vendor.id, status),
                    t("status.changed", { name: vendor.name, status: t(`statuses.${status}`) }),
                  )
                }
              >
                {t(`statuses.${status}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="ml-auto flex">
          {vendor.url && (
            <Button variant="ghost" size="icon-sm" asChild className="text-stone">
              <a href={vendor.url} target="_blank" rel="noopener noreferrer" aria-label={t("site", { name: vendor.name })}>
                <ExternalLinkIcon aria-hidden />
              </a>
            </Button>
          )}
          <VendorDialog
            category={vendor.category}
            vendor={vendor}
            currencySymbol={currencySymbol}
            guestCount={guestCount}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={t("editLabel", { name: vendor.name })} className="text-stone">
                <PencilIcon aria-hidden />
              </Button>
            }
          />
          <ConfirmDelete name={vendor.name} onConfirm={() => run(() => deleteVendor(vendor.id), t("deleted", { name: vendor.name }))} />
        </span>
      </div>
    </li>
  );
}

function checkLabel(
  t: ReturnType<typeof useTranslations<"Vendors">>,
  check: VendorCheck,
  money: (amount: number) => string,
) {
  switch (check.key) {
    case "overBudget":
      return t("checks.overBudget", { amount: money(check.over) });
    case "paymentLate":
      return t("checks.paymentLate", { instalment: t(`payments.${check.instalment}`), amount: money(check.amount) });
    case "paymentSoon":
      return t("checks.paymentSoon", {
        instalment: t(`payments.${check.instalment}`),
        amount: money(check.amount),
        days: check.days,
      });
    case "depositDue":
      return t("checks.depositDue", { amount: money(check.amount) });
    case "meetingSoon":
      return t("checks.meetingSoon", { count: check.days });
    case "askQuote":
      return t("checks.askQuote");
  }
}

function ConfirmDelete({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const t = useTranslations("Vendors");
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

/** Où en sont les paiements : réglé, reste à payer, prochain versement. */
function PaymentLine({
  vendor,
  guestCount,
  money,
}: {
  vendor: Vendor;
  guestCount: number | null;
  money: (amount: number) => string;
}) {
  const t = useTranslations("Vendors.payments");
  const format = useFormatter();
  const { instalments, paid, remaining, next } = paymentSummary(vendor, guestCount);
  if (instalments.length === 0 || vendor.status === "declined") return null;
  const total = paid + remaining;
  return (
    <div className="flex flex-col gap-1.5">
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-linen">
        <div className="h-full rounded-full bg-sage" style={{ width: `${total > 0 ? (paid / total) * 100 : 0}%` }} />
      </div>
      <p className="text-sm text-charcoal">
        {remaining === 0 ? t("allPaid", { paid: money(paid) }) : t("summary", { paid: money(paid), remaining: money(remaining) })}
      </p>
      {next && (
        <p className="text-xs text-stone">
          {next.due
            ? t("next", {
                amount: money(next.amount),
                date: format.dateTime(isoDateToUtc(next.due), { day: "numeric", month: "long", timeZone: "UTC" }),
              })
            : t("nextNoDate", { amount: money(next.amount) })}
        </p>
      )}
    </div>
  );
}

/** Les détails de la catégorie renseignés, en quelques étiquettes. */
function DetailChips({ vendor }: { vendor: Vendor }) {
  const t = useTranslations("Vendors");
  const format = useFormatter();
  const chips = DETAIL_FIELDS[vendor.category]
    .filter((field) => vendor.details[field.key] !== undefined)
    .map((field) => {
      const raw = vendor.details[field.key] as string | number;
      const value =
        field.kind === "select"
          ? t(`options.${field.key}.${raw}` as "options.kind.dj")
          : field.kind === "date"
            ? format.dateTime(isoDateToUtc(String(raw)), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
            : String(raw);
      return { key: field.key, label: t(`details.${vendor.category}.${field.key}` as "details.cake.style"), value };
    });
  if (chips.length === 0) return null;
  return (
    <dl className="flex flex-col gap-1 rounded-2xl bg-linen/60 px-3 py-2.5 text-sm">
      {chips.map((chip) => (
        <div key={chip.key} className="flex flex-wrap gap-x-2">
          <dt className="text-stone">{chip.label}</dt>
          <dd className="min-w-0 wrap-break-word text-charcoal">{chip.value}</dd>
        </div>
      ))}
    </dl>
  );
}

import { ChevronRightIcon, CircleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { VENDOR_ICONS } from "@/components/vendors/icons";
import { Link, redirect } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { VENDOR_CATEGORIES, VENDOR_SECTIONS, vendorHref } from "@/lib/vendors/catalog";
import { upcomingPayments } from "@/lib/vendors/payments";
import { categoryProgress, vendorTotal } from "@/lib/vendors/plan";
import { isoDateToUtc, todayIsoDate } from "@/lib/weddings/dates";
import { expectedGuests } from "@/lib/venues/compare";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getGuests,
  getVendors,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

export async function generateMetadata({ params }: PageProps<"/[locale]/vendors">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Vendors" });
  return { title: t("metaTitle") };
}

/** Vue d'ensemble des prestataires : où en est chaque catégorie. */
export default async function VendorsPage({ params }: PageProps<"/[locale]/vendors">) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return redirect({ href: "/login", locale });
  }
  const wedding = await getCurrentWedding(supabase);
  if (!wedding) {
    return redirect({ href: "/onboarding", locale });
  }
  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  if (role !== "owner" && role !== "partner") {
    return redirect({ href: "/dashboard", locale });
  }

  const [vendors, guests, t, format] = await Promise.all([
    getVendors(supabase, wedding.id),
    getGuests(supabase, wedding.id),
    getTranslations("Vendors"),
    getFormatter(),
  ]);
  const guestCount = expectedGuests(
    guests.filter((guest) => guest.status !== "declined").length,
    wedding.guest_count,
  );
  const progress = categoryProgress(vendors);
  // « Autres prestataires » ne compte pas comme une catégorie à pourvoir.
  const toFill = VENDOR_CATEGORIES.filter((category) => category !== "other");
  const bookedCategories = toFill.filter((category) => progress[category].booked.length > 0).length;
  const committed = vendors
    .filter((vendor) => vendor.status === "booked")
    .reduce((sum, vendor) => sum + (vendorTotal(vendor, guestCount) ?? 0), 0);
  const schedule = upcomingPayments(vendors, guestCount, todayIsoDate()).slice(0, 8);
  const PRINCIPLES = ["priorities", "research", "referrals", "meet", "contracts", "budget"] as const;
  const money = (amount: number) =>
    format.number(amount, { style: "currency", currency: wedding.currency_code, maximumFractionDigits: 0 });

  return (
    <main className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20">
      <div className="flex w-full min-w-0 max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">{t("eyebrow")}</p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">{t("title")}</h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t("intro")}</p>
        </header>

        <dl className="grid grid-cols-3 gap-3">
          {([
            { key: "booked", value: `${bookedCategories}/${toFill.length}`, surface: "bg-sage-soft" },
            {
              key: "leads",
              value: format.number(VENDOR_CATEGORIES.reduce((sum, category) => sum + progress[category].leads, 0)),
              surface: "bg-linen",
            },
            { key: "committed", value: money(committed), surface: "bg-terracotta-soft/60" },
          ] as const).map(({ key, value, surface }) => (
            <div key={key} className={`flex min-w-0 flex-col-reverse gap-1 rounded-3xl px-4 py-4 sm:px-5 ${surface}`}>
              <dt className="text-sm text-stone">{t(`overview.kpis.${key}`)}</dt>
              <dd className="truncate font-serif text-2xl text-charcoal tabular-nums sm:text-3xl">{value}</dd>
            </div>
          ))}
        </dl>

        {vendors.some((vendor) => vendor.status === "booked") && (
          <section aria-labelledby="schedule-title" className="flex flex-col gap-4 rounded-3xl bg-card p-6 ring-1 ring-border">
            <div className="flex flex-col gap-1">
              <h2 id="schedule-title" className="font-serif text-2xl">{t("overview.schedule.title")}</h2>
              <p className="text-sm text-stone">{t("overview.schedule.lead")}</p>
            </div>
            {schedule.length === 0 ? (
              <p className="text-stone">{t("overview.schedule.empty")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {schedule.map((payment) => {
                  const late = payment.days !== null && payment.days < 0;
                  return (
                    <li key={`${payment.vendor.id}-${payment.kind}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                      <Link href={vendorHref(payment.vendor.category)} className="min-w-0 hover:text-sage-deep">
                        {t("overview.schedule.item", {
                          instalment: t(`payments.${payment.kind}`),
                          vendor: payment.vendor.name,
                        })}
                      </Link>
                      <span className="flex items-center gap-3 text-sm">
                        <span className={late ? "inline-flex items-center gap-1 text-terracotta" : "text-stone"}>
                          {late && <CircleAlertIcon aria-hidden className="size-3.5" />}
                          {payment.due === null
                            ? t("overview.schedule.noDate")
                            : late
                              ? t("overview.schedule.late")
                              : `${t("overview.schedule.in", { days: payment.days ?? 0 })} · ${format.dateTime(isoDateToUtc(payment.due), { day: "numeric", month: "short", timeZone: "UTC" })}`}
                        </span>
                        <span className="font-serif text-lg tabular-nums">{money(payment.amount)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {VENDOR_SECTIONS.map((section) => (
          <section key={section.key} aria-labelledby={`section-${section.key}`} className="flex flex-col gap-4">
            <h2 id={`section-${section.key}`} className="font-serif text-3xl">{t(`overview.sections.${section.key}`)}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.categories.map((category) => {
                const Icon = VENDOR_ICONS[category];
                const { booked, leads } = progress[category];
                return (
                  <li key={category}>
                    <Link
                      href={vendorHref(category)}
                      className={cn(
                        "flex h-full items-center gap-4 rounded-3xl p-4 ring-1 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                        booked.length > 0
                          ? "bg-sage-soft/60 ring-sage/40 hover:bg-sage-soft"
                          : "bg-card ring-border hover:bg-linen/60",
                      )}
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-sage-deep ring-1 ring-border">
                        <Icon aria-hidden className="size-5" strokeWidth={1.5} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="font-medium">{t(`categories.${category}.label`)}</span>
                        <span className={cn("truncate text-sm", booked.length > 0 ? "text-sage-deep" : "text-stone")}>
                          {booked.length > 0
                            ? t("overview.booked", { names: format.list(booked) })
                            : leads > 0
                              ? t("overview.leads", { count: leads })
                              : t("overview.none")}
                        </span>
                      </span>
                      <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-stone" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <section aria-labelledby="principles-title" className="flex flex-col gap-4">
          <h2 id="principles-title" className="font-serif text-3xl">{t("overview.principles.title")}</h2>
          <ol className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((key, index) => (
              <li key={key} className="flex gap-4">
                <span className="font-serif text-2xl leading-none text-terracotta tabular-nums">{index + 1}</span>
                <span className="flex flex-col gap-1">
                  <span className="font-medium">{t(`overview.principles.items.${key}.title`)}</span>
                  <span className="text-sm leading-6 text-stone">{t(`overview.principles.items.${key}.body`)}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}

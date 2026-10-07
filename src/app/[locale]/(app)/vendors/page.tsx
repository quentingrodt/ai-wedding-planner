import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { VENDOR_ICONS } from "@/components/vendors/icons";
import { Link, redirect } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { VENDOR_CATEGORIES, VENDOR_SECTIONS, vendorHref } from "@/lib/vendors/catalog";
import { categoryProgress, vendorTotal } from "@/lib/vendors/plan";
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
      </div>
    </main>
  );
}

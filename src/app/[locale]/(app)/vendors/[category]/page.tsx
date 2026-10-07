import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { Link, redirect } from "@/i18n/navigation";
import { categoryFromSlug, VENDOR_CATALOG } from "@/lib/vendors/catalog";
import { budgetEnvelope } from "@/lib/vendors/plan";
import { expectedGuests } from "@/lib/venues/compare";
import { todayIsoDate } from "@/lib/weddings/dates";
import {
  getBudgetItems,
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getGuests,
  getVendors,
  getVenues,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { VendorBoard } from "../_components/vendor-board";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/vendors/[category]">): Promise<Metadata> {
  const { locale, category: slug } = await params;
  const category = categoryFromSlug(slug);
  const t = await getTranslations({ locale: locale as Locale, namespace: "Vendors" });
  return { title: category ? t(`categories.${category}.title`) : t("metaTitle") };
}

export default async function VendorCategoryPage({ params }: PageProps<"/[locale]/vendors/[category]">) {
  const { locale: rawLocale, category: slug } = await params;
  const locale = rawLocale as Locale;
  setRequestLocale(locale);
  const category = categoryFromSlug(slug);
  if (!category) notFound();

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return redirect({ href: "/login", locale });
  }
  const wedding = await getCurrentWedding(supabase);
  if (!wedding) {
    return redirect({ href: "/onboarding", locale });
  }

  // Les prix des prestataires relèvent du budget : réservés aux mariés, comme lui.
  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  if (role !== "owner" && role !== "partner") {
    return redirect({ href: "/dashboard", locale });
  }

  const definition = VENDOR_CATALOG[category];
  const [vendors, budgetItems, guests, venues, t] = await Promise.all([
    getVendors(supabase, wedding.id, category),
    getBudgetItems(supabase, wedding.id),
    getGuests(supabase, wedding.id),
    category === "catering" ? getVenues(supabase, wedding.id) : Promise.resolve([]),
    getTranslations("Vendors"),
  ]);
  const venueCatering = venues.find((venue) => venue.status === "booked")?.catering ?? null;

  return (
    <main className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20">
      <div className="flex w-full min-w-0 max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <Link
            href="/vendors"
            className="w-fit text-xs font-medium tracking-[0.2em] text-terracotta uppercase hover:text-charcoal"
          >
            {t("eyebrow")}
          </Link>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            {t(`categories.${category}.title`)}
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t(`categories.${category}.intro`)}</p>
        </header>

        <VendorBoard
          // Une fiche neuve par catégorie : l'état des dialogues ne passe pas d'une page à l'autre.
          key={category}
          category={category}
          vendors={vendors}
          guestCount={expectedGuests(
            guests.filter((guest) => guest.status !== "declined").length,
            wedding.guest_count,
          )}
          envelope={budgetEnvelope(budgetItems, definition.budget)}
          venueCatering={venueCatering}
          today={todayIsoDate()}
          currency={wedding.currency_code}
        />
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}

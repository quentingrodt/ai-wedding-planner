import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { redirect } from "@/i18n/navigation";
import { expectedGuests, venueBudgetEnvelope } from "@/lib/venues/compare";
import {
  getBudgetItems,
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getGuests,
  getVenues,
  getWeddingStyleDna,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { VenuesBoard } from "./_components/venues-board";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/venues">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Venues" });
  return { title: t("metaTitle") };
}

export default async function VenuesPage({ params }: PageProps<"/[locale]/venues">) {
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

  // Les prix des lieux relèvent du budget : réservés aux mariés, comme lui.
  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  if (role !== "owner" && role !== "partner") {
    return redirect({ href: "/dashboard", locale });
  }

  const [venues, budgetItems, guests, styleDna, t] = await Promise.all([
    getVenues(supabase, wedding.id),
    getBudgetItems(supabase, wedding.id),
    getGuests(supabase, wedding.id),
    getWeddingStyleDna(supabase, wedding.id),
    getTranslations("Venues"),
  ]);

  const context = {
    guestCount: expectedGuests(
      guests.filter((guest) => guest.status !== "declined").length,
      wedding.guest_count,
    ),
    venueBudget: venueBudgetEnvelope(budgetItems, wedding.total_budget),
    ambiance: styleDna.ambiance ?? null,
  };

  return (
    <main className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20">
      <div className="flex w-full min-w-0 max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">{t("eyebrow")}</p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t("intro")}</p>
        </header>

        <VenuesBoard venues={venues} context={context} currency={wedding.currency_code} />
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}

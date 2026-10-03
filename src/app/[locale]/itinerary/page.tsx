import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { Link, redirect } from "@/i18n/navigation";
import { isoDateToUtc } from "@/lib/weddings/dates";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getItineraryEvents,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { ItineraryTimeline } from "./_components/itinerary-timeline";
import { PrintButton } from "./_components/print-button";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/itinerary">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "Itinerary",
  });
  return { title: t("metaTitle") };
}

export default async function ItineraryPage({
  params,
}: PageProps<"/[locale]/itinerary">) {
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

  const [role, events, t, format] = await Promise.all([
    getCurrentMemberRole(supabase, wedding.id, userId),
    getItineraryEvents(supabase, wedding.id),
    getTranslations("Itinerary"),
    getFormatter(),
  ]);
  const canEdit = role === "owner" || role === "partner";

  // En-tête du document imprimé : le conducteur circule hors de l'app.
  const weddingDate =
    wedding.wedding_date === null
      ? null
      : format.dateTime(isoDateToUtc(wedding.wedding_date), {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        });

  return (
    <main className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20 print:p-0">
      <div className="flex w-full min-w-0 max-w-3xl flex-col gap-10 print:max-w-none print:gap-8">
        <header className="flex flex-col gap-4">
          <Link
            href="/dashboard"
            className="inline-flex w-fit items-center gap-2 text-sm text-stone transition-colors hover:text-foreground print:hidden"
          >
            <ArrowLeftIcon aria-hidden className="size-4" />
            {t("back")}
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-col gap-4">
              <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
                {t("eyebrow")}
              </p>
              <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
                {t("title")}
              </h1>
              <p className="text-lg wrap-break-word text-sage-deep">
                {weddingDate
                  ? t("subtitle", { names: wedding.title, date: weddingDate })
                  : wedding.title}
              </p>
            </div>
            <PrintButton />
          </div>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground print:hidden">
            {t("intro")}
          </p>
          {!canEdit && (
            <p className="rounded-3xl bg-linen px-6 py-5 text-stone print:hidden">
              {t("readOnly")}
            </p>
          )}
        </header>

        <ItineraryTimeline events={events} canEdit={canEdit} />
      </div>
      <div className="print:hidden">
        <Toaster position="bottom-center" />
      </div>
    </main>
  );
}

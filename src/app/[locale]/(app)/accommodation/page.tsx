import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { redirect } from "@/i18n/navigation";
import { todayIsoDate } from "@/lib/weddings/dates";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getGuestFamilies,
  getLodging,
  getPlanningSetup,
  getVenues,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { AccommodationBoard } from "./_components/accommodation-board";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/accommodation">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Lodging" });
  return { title: t("metaTitle") };
}

export default async function AccommodationPage({ params }: PageProps<"/[locale]/accommodation">) {
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
  const canEdit = role === "owner" || role === "partner";

  const [{ guests, lodgings }, families, { answers }, venues, t] = await Promise.all([
    getLodging(supabase, wedding.id),
    getGuestFamilies(supabase, wedding.id),
    getPlanningSetup(supabase, wedding.id),
    // Les lieux sont réservés aux mariés (cf. 000027) : un témoin n'en lit aucun.
    canEdit ? getVenues(supabase, wedding.id) : Promise.resolve([]),
    getTranslations("Lodging"),
  ]);
  const bookedVenue = venues.find((venue) => venue.status === "booked") ?? null;

  return (
    <main className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20">
      <div className="flex w-full min-w-0 max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">{t("eyebrow")}</p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t("intro")}</p>
          {(lodgings.length > 0 || guests.some((guest) => guest.needs_lodging)) && (
            // Route API (fichier téléchargé) : lien classique, pas de navigation client.
            <a
              href={`/api/lodging/pdf?locale=${locale}`}
              download
              title={t("pdf.triggerHint")}
              className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-linen px-5 text-sm text-sage-deep ring-1 ring-sand transition-colors hover:bg-sage-soft"
            >
              <DownloadIcon aria-hidden className="size-4" />
              {t("pdf.trigger")}
            </a>
          )}
          {!canEdit && <p className="rounded-3xl bg-linen px-6 py-5 text-stone">{t("readOnly")}</p>}
        </header>

        <AccommodationBoard
          guests={guests}
          families={families}
          lodgings={lodgings}
          weddingDate={wedding.wedding_date}
          today={todayIsoDate()}
          // null : questionnaire du rétroplanning pas encore rempli.
          plannedLodging={answers?.guestAccommodation ?? null}
          bookedVenue={
            bookedVenue && bookedVenue.beds
              ? { name: bookedVenue.name, location: bookedVenue.location, beds: bookedVenue.beds }
              : null
          }
          currency={wedding.currency_code}
          canEdit={canEdit}
        />
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}

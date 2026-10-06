import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { redirect } from "@/i18n/navigation";
import { suggestInvitationDesign } from "@/lib/invitations/schema";
import { addDaysToIsoDate, isoDateToUtc } from "@/lib/weddings/dates";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getInvitation,
  getPlanningSetup,
  getWeddingStyleDna,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { InvitationEditor } from "./_components/invitation-editor";
import type { WizardDefaults } from "./_components/invitation-wizard";

/** Délai de réponse proposé par défaut : environ six semaines avant le mariage. */
const RSVP_DAYS_BEFORE = 45;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/invitations">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Invitations" });
  return { title: t("metaTitle") };
}

export default async function InvitationsPage({ params }: PageProps<"/[locale]/invitations">) {
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

  const [role, invitation, styleDna, planning, t, format] = await Promise.all([
    getCurrentMemberRole(supabase, wedding.id, userId),
    getInvitation(supabase, wedding.id),
    getWeddingStyleDna(supabase, wedding.id),
    getPlanningSetup(supabase, wedding.id),
    getTranslations("Invitations"),
    getFormatter(),
  ]);

  // Ce qu'on sait déjà du mariage : il pré-remplit le questionnaire et le premier design.
  const date = wedding.wedding_date;
  const longDate = date
    ? format.dateTime(isoDateToUtc(date), {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";
  const ambiance = styleDna.likes.venue?.[0] ?? styleDna.ambiance ?? null;
  const wizardDefaults: WizardDefaults = {
    names: wedding.title,
    dateText: longDate.charAt(0).toLocaleUpperCase(locale) + longDate.slice(1),
    // Repère de couverture : « 24 · 06 · 2027 ».
    coverDate: date
      ? format
          .dateTime(isoDateToUtc(date), {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            timeZone: "UTC",
          })
          .replace(/[/.-]/g, " · ")
      : "",
    rsvpNote: date
      ? t("defaults.rsvpNote", {
          date: format.dateTime(isoDateToUtc(addDaysToIsoDate(date, -RSVP_DAYS_BEFORE)), {
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          }),
        })
      : t("defaults.rsvpNoteNoDate"),
    ambiance,
    religious: planning.answers?.religiousCeremony ?? false,
    secular: planning.answers?.secularCeremony ?? false,
  };

  const design =
    invitation?.design ??
    suggestInvitationDesign({
      likes: styleDna.likes,
      ambiance: styleDna.ambiance,
      names: wizardDefaults.names,
      coverHint: wizardDefaults.coverDate,
      closingNote: t("defaults.closingNote"),
      dateText: wizardDefaults.dateText,
      intro: t("defaults.intro"),
      rsvpNote: wizardDefaults.rsvpNote,
    });

  return (
    <main className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20">
      <div className="flex w-full min-w-0 max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t("intro")}</p>
        </header>

        <InvitationEditor
          initialDesign={design}
          canEdit={role === "owner" || role === "partner"}
          watermarked={!invitation?.unlockedAt}
          saved={invitation !== null}
          recommendedAmbiance={ambiance}
          wizardDefaults={wizardDefaults}
        />
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}

import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { redirect } from "@/i18n/navigation";
import { initialStepTwo } from "@/lib/onboarding/step-two";
import { isoDateToUtc } from "@/lib/weddings/dates";
import { monogram } from "@/lib/weddings/monogram";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getPlanningSetup,
  getWeddingPhotoUrl,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { StepTwoForm } from "./step-two-form";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/onboarding/step-2">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "OnboardingStepTwo" });
  return { title: t("metaTitle") };
}

/**
 * Étape 2 de l'onboarding, juste après la création du projet : une revue
 * légère de chaque poste pour préremplir l'espace. Réservée aux mariés.
 */
export default async function StepTwoPage({ params }: PageProps<"/[locale]/onboarding/step-2">) {
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

  const [{ answers }, photoUrl, t, format] = await Promise.all([
    getPlanningSetup(supabase, wedding.id),
    getWeddingPhotoUrl(wedding.photo_path),
    getTranslations("OnboardingStepTwo"),
    getFormatter(),
  ]);

  return (
    <main className="flex flex-1 justify-center bg-ivory px-5 pt-14 pb-24 sm:px-6 sm:pt-20">
      <div className="flex w-full min-w-0 max-w-2xl flex-col gap-12">
        <header className="flex flex-col gap-4 text-center">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">{t("eyebrow")}</p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">{t("title")}</h1>
          <p className="mx-auto max-w-lg text-lg leading-8 text-pretty text-muted-foreground">{t("intro")}</p>
        </header>
        <StepTwoForm
          initial={initialStepTwo(answers)}
          currency={wedding.currency_code}
          weddingDate={
            wedding.wedding_date
              ? format.dateTime(isoDateToUtc(wedding.wedding_date), {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })
              : null
          }
          photo={{ url: photoUrl, initials: monogram(wedding.title) }}
        />
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}

import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import {
  DEFAULT_CURRENCY,
  HANDOFF_KEYS,
  parseHandoff,
  toHandoffQuery,
} from "@/lib/onboarding/schema";
import { getCurrentUserId, getCurrentWedding } from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { OnboardingForm } from "./onboarding-form";
import { RestoreProject } from "./restore-project";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/onboarding">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "Onboarding",
  });
  return { title: t("metaTitle") };
}

export default async function OnboardingPage({
  params,
  searchParams,
}: PageProps<"/[locale]/onboarding">) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as Locale;
  setRequestLocale(locale);
  const handoff = parseHandoff(await searchParams);

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) {
    // Le projet Date Night est conservé pour la prochaine connexion.
    const query = Object.fromEntries(
      HANDOFF_KEYS.flatMap((key) =>
        handoff[key] === undefined ? [] : [[key, String(handoff[key])]],
      ),
    );
    return redirect({ href: { pathname: "/login", query }, locale });
  }

  // Onboarding déjà fait : on file directement au tableau de bord.
  if (await getCurrentWedding(supabase)) {
    return redirect({ href: "/dashboard", locale });
  }

  const t = await getTranslations("Onboarding");
  const projectQuery = toHandoffQuery(handoff);

  return (
    <main className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20">
      <div className="flex w-full min-w-0 max-w-2xl flex-col gap-12">
        <header className="flex flex-col gap-4 text-center">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mx-auto max-w-lg text-lg leading-8 text-muted-foreground">
            {t("intro")}
          </p>
        </header>
        {/* URL sans projet : on tente de le retrouver dans le navigateur. */}
        {!projectQuery && <RestoreProject />}
        <OnboardingForm
          // key : le formulaire (valeurs par défaut, ambiance) se recrée si le projet est restauré.
          key={projectQuery}
          handoff={handoff}
          currency={DEFAULT_CURRENCY}
          minDate={new Date().toISOString().slice(0, 10)}
        />
      </div>
    </main>
  );
}

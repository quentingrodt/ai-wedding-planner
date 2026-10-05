import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getLatestWeddingPlan,
  getWeddingStyleDna,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { InspirationBook } from "./_components/inspiration-book";
import { InspirationTabs } from "./_components/inspiration-tabs";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/inspiration">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "Inspiration.book",
  });
  return { title: t("metaTitle") };
}

export default async function InspirationPage({ params }: PageProps<"/[locale]/inspiration">) {
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

  const [styleDna, role] = await Promise.all([
    getWeddingStyleDna(supabase, wedding.id),
    getCurrentMemberRole(supabase, wedding.id, userId),
  ]);
  // Le plan contient le budget : réservé aux mariés (RLS alignée).
  const isCouple = role === "owner" || role === "partner";
  const plan = isCouple ? await getLatestWeddingPlan(supabase, wedding.id) : null;

  return (
    // overflow-x-clip : les cartes swipées sortent de l'écran sans créer de défilement horizontal.
    <main className="flex flex-1 justify-center overflow-x-clip px-5 pt-8 pb-24 sm:px-6 sm:pt-16">
      <div className="flex w-full min-w-0 max-w-3xl flex-col gap-8">
        <InspirationTabs />
        <InspirationBook
          initialLikes={styleDna.likes}
          canEdit={isCouple}
          initialPlan={plan}
          currency={wedding.currency_code}
        />
      </div>
    </main>
  );
}

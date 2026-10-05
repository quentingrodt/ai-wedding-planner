import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { redirect } from "@/i18n/navigation";
import { orderedPresets } from "@/lib/inspiration/palette";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getWeddingStyleDna,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { InspirationTabs } from "../_components/inspiration-tabs";
import { PaletteStudio } from "../_components/palette-studio";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/inspiration/palette">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Inspiration.palette" });
  return { title: t("metaTitle") };
}

export default async function PalettePage({ params }: PageProps<"/[locale]/inspiration/palette">) {
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

  const [styleDna, role, t] = await Promise.all([
    getWeddingStyleDna(supabase, wedding.id),
    getCurrentMemberRole(supabase, wedding.id, userId),
    getTranslations("Inspiration.palette"),
  ]);
  const canEdit = role === "owner" || role === "partner";
  // Lieux aimés dans les swipes, sinon l'ambiance choisie à l'onboarding.
  const venues = styleDna.likes.venue ?? (styleDna.ambiance ? [styleDna.ambiance] : []);

  return (
    <main className="flex flex-1 justify-center px-5 pt-8 pb-24 sm:px-6 sm:pt-16">
      <div className="flex w-full min-w-0 max-w-4xl flex-col gap-10">
        <InspirationTabs />
        <header className="flex flex-col gap-4">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t("intro")}</p>
          {!canEdit && <p className="rounded-3xl bg-linen px-6 py-5 text-stone">{t("readOnly")}</p>}
        </header>

        <PaletteStudio
          initialColors={styleDna.palette?.colors ?? []}
          presets={orderedPresets(venues)}
          canEdit={canEdit}
          names={wedding.title}
        />
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}

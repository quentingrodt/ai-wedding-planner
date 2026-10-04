import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DateNightFlow } from "./_components/date-night-flow";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/date-night">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "DateNight",
  });
  return { title: t("metaTitle") };
}

export default async function DateNightPage({
  params,
}: PageProps<"/[locale]/date-night">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    // overflow-x-clip : les cartes swipées sortent de l'écran sans créer de défilement horizontal.
    <main className="flex flex-1 justify-center overflow-x-clip px-5 pt-8 pb-24 sm:px-6 sm:pt-20">
      <div className="flex w-full min-w-0 max-w-2xl flex-col gap-12">
        <DateNightFlow />
      </div>
    </main>
  );
}

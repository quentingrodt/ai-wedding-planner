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
  const t = await getTranslations("DateNight");

  return (
    <main className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20">
      <div className="flex w-full min-w-0 max-w-2xl flex-col gap-12">
        <header className="flex flex-col gap-4">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            {t("title")}
          </h1>
          <p className="text-lg leading-8 text-muted-foreground">
            {t("intro")}
          </p>
        </header>
        <DateNightFlow />
      </div>
    </main>
  );
}

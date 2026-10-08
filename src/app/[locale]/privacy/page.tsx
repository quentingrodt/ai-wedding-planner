import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { fillOperator, LegalPage, operatorValues, type LegalSection } from "@/components/legal/legal-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Legal.Privacy" });
  return { title: t("title") };
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Legal.Privacy");
  const values = await operatorValues();

  // Les paragraphes citent l’éditeur : {name}, {email}, {host}…
  const sections = (t.raw("sections") as LegalSection[]).map((section) => ({
    title: section.title,
    paragraphs: section.paragraphs.map((paragraph) => fillOperator(paragraph, values)),
  }));

  return <LegalPage title={t("title")} intro={t("intro")} sections={sections} />;
}

import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";
import { LEGAL_OPERATOR, LEGAL_UPDATED_AT } from "@/lib/legal/operator";

export type LegalSection = { title: string; paragraphs: string[] };

/** Valeurs de l'éditeur, ou « à compléter » tant qu'elles sont vides. */
export async function operatorValues() {
  const t = await getTranslations("Legal");
  const fill = (value: string) => value.trim() || t("missing");
  return {
    name: fill(LEGAL_OPERATOR.name),
    address: fill(LEGAL_OPERATOR.address),
    email: fill(LEGAL_OPERATOR.email),
    director: fill(LEGAL_OPERATOR.publicationDirector),
    host: fill(LEGAL_OPERATOR.host),
  };
}

/** Remplace {name}, {email}… par les valeurs de l’éditeur (texte brut, sans ICU). */
export function fillOperator(text: string, values: Record<string, string>) {
  return text.replace(/{(w+)}/g, (match, key: string) => values[key] ?? match);
}

/** Mise en page éditoriale commune à la politique de confidentialité et aux mentions légales. */
export async function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro?: ReactNode;
  sections: LegalSection[];
}) {
  const t = await getTranslations("Legal");
  const format = await getFormatter();
  const updated = format.dateTime(new Date(`${LEGAL_UPDATED_AT}T00:00:00Z`), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="flex flex-1 flex-col bg-ivory">
      <header className="flex justify-center border-b border-sand/60 px-6 py-6">
        <Link href="/" aria-label={t("home")} className="text-2xl text-charcoal">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20">
        <article className="flex w-full max-w-2xl flex-col gap-10">
          <header className="flex flex-col gap-4">
            <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
              {t("updated", { date: updated })}
            </p>
            <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">{title}</h1>
            {intro && <p className="text-lg leading-8 text-pretty text-stone">{intro}</p>}
          </header>
          {sections.map((section) => (
            <section key={section.title} className="flex flex-col gap-3">
              <h2 className="font-serif text-2xl text-charcoal">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="leading-7 text-pretty text-charcoal/85">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
          <nav className="flex flex-wrap gap-x-6 gap-y-2 border-t border-sand pt-6 text-sm text-stone">
            <Link href="/privacy" className="underline-offset-4 hover:underline">
              {t("links.privacy")}
            </Link>
            <Link href="/legal" className="underline-offset-4 hover:underline">
              {t("links.legal")}
            </Link>
          </nav>
        </article>
      </main>
    </div>
  );
}

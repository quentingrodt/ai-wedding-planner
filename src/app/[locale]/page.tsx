import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import {
  ArrowDown,
  ArrowRight,
  CalendarRange,
  FileSearch,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "next-intl";

const PILLARS: { key: "planning" | "budget" | "quotes"; icon: LucideIcon }[] = [
  { key: "planning", icon: CalendarRange },
  { key: "budget", icon: Wallet },
  { key: "quotes", icon: FileSearch },
];

const ROMAN = ["I", "II", "III"];

export default function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);

  const t = useTranslations("Index");
  const tCommon = useTranslations("Common");

  return (
    <div className="flex flex-1 flex-col bg-ivory text-charcoal">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-7 sm:px-10">
        <Link href="/" className="font-serif text-xl tracking-tight sm:text-2xl">
          AI Wedding Planner
        </Link>
        <Link
          href="/login"
          className="text-right text-sm text-stone underline decoration-sand decoration-1 underline-offset-[6px] transition-colors hover:text-charcoal hover:decoration-terracotta"
        >
          {tCommon("login")}
        </Link>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero éditorial */}
        <section className="relative mx-auto w-full max-w-6xl px-6 pt-16 pb-24 sm:px-10 sm:pt-24 sm:pb-36">
          <div className="flex items-center gap-4">
            <span className="h-px w-10 bg-terracotta" aria-hidden />
            <p className="text-xs font-medium tracking-[0.25em] text-terracotta uppercase">
              {t("eyebrow")}
            </p>
          </div>

          <h1 className="mt-10 max-w-5xl text-[2.75rem] leading-[1.05] tracking-tight text-balance sm:text-7xl lg:text-[6.5rem]">
            {t.rich("title", {
              em: (chunks) => (
                <em className="block font-normal text-stone italic">{chunks}</em>
              ),
            })}
          </h1>

          <div className="mt-14 grid gap-12 sm:mt-20 lg:grid-cols-12">
            <p className="text-lg leading-8 text-stone sm:text-xl sm:leading-9 lg:col-span-5 lg:col-start-8 lg:border-l lg:border-sand lg:pl-10">
              {t("subtitle")}
            </p>
            <a
              href="#carrefour"
              className="inline-flex items-center gap-3 self-end text-sm font-medium tracking-wide transition-colors hover:text-terracotta lg:col-span-4 lg:col-start-1 lg:row-start-1"
            >
              <span className="flex size-10 items-center justify-center rounded-full border border-sand">
                <ArrowDown className="size-4" strokeWidth={1.25} aria-hidden />
              </span>
              {t("heroCta")}
            </a>
          </div>
        </section>

        {/* Les trois piliers */}
        <section className="border-y border-sand/70 bg-linen/60">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-10 sm:py-28">
            <p className="text-xs font-medium tracking-[0.25em] text-stone uppercase">
              {t("pillarsEyebrow")}
            </p>
            <ul className="mt-14 grid gap-14 md:grid-cols-3 md:gap-0">
              {PILLARS.map(({ key, icon: Icon }, i) => (
                <li
                  key={key}
                  className="flex flex-col gap-6 md:px-10 md:first:pl-0 md:last:pr-0 md:border-l md:border-sand md:first:border-l-0"
                >
                  <div className="flex items-baseline justify-between">
                    <Icon
                      className={i === 1 ? "size-7 text-sage" : "size-7 text-terracotta"}
                      strokeWidth={1}
                      aria-hidden
                    />
                    <span className="font-serif text-sm text-stone/70 italic">{ROMAN[i]}</span>
                  </div>
                  <h2 className="text-2xl leading-snug tracking-tight sm:text-3xl">
                    {t(`pillars.${key}.title`)}
                  </h2>
                  <p className="text-[0.95rem] leading-7 text-stone">
                    {t(`pillars.${key}.body`)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Le carrefour */}
        <section
          id="carrefour"
          className="mx-auto w-full max-w-6xl scroll-mt-8 px-6 py-24 sm:px-10 sm:py-36"
        >
          <div className="flex flex-col items-center text-center">
            <p className="text-xs font-medium tracking-[0.25em] text-terracotta uppercase">
              {t("crossroadsEyebrow")}
            </p>
            <h2 className="mt-6 max-w-3xl text-4xl leading-tight tracking-tight text-balance sm:text-6xl">
              {t("crossroadsTitle")}
            </h2>
          </div>

          <div className="mt-16 grid gap-6 sm:mt-20 md:grid-cols-2 md:gap-8">
            {/* Carte 1 — Date Night */}
            <article className="group flex flex-col rounded-2xl border border-sand/60 bg-sage-soft/50 p-8 shadow-[0_20px_60px_-30px_rgba(43,42,40,0.18)] transition-shadow duration-500 hover:shadow-[0_30px_80px_-30px_rgba(43,42,40,0.25)] sm:p-12">
              <p className="font-serif text-sm text-sage-deep italic">
                {t("dateNight.label")}
              </p>
              <h3 className="mt-8 text-3xl leading-tight tracking-tight sm:text-4xl">
                {t("dateNight.title")}
              </h3>
              <p className="mt-5 max-w-sm leading-7 text-stone">{t("dateNight.body")}</p>
              <div className="mt-auto pt-12">
                <Link
                  href="/date-night"
                  className="inline-flex h-12 items-center gap-3 rounded-full border border-sage-deep/30 px-7 text-sm font-medium text-sage-deep transition-colors hover:border-sage-deep hover:bg-sage-deep hover:text-ivory"
                >
                  {t("dateNight.cta")}
                  <ArrowRight
                    className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                    strokeWidth={1.5}
                  />
                </Link>
              </div>
            </article>

            {/* Carte 2 — Organisation */}
            <article className="group flex flex-col rounded-2xl border border-sand/60 bg-card p-8 shadow-[0_20px_60px_-30px_rgba(43,42,40,0.18)] transition-shadow duration-500 hover:shadow-[0_30px_80px_-30px_rgba(43,42,40,0.25)] sm:p-12">
              <p className="font-serif text-sm text-terracotta italic">
                {t("organize.label")}
              </p>
              <h3 className="mt-8 text-3xl leading-tight tracking-tight sm:text-4xl">
                {t("organize.title")}
              </h3>
              <p className="mt-5 max-w-sm leading-7 text-stone">{t("organize.body")}</p>
              <div className="mt-auto pt-12">
                <Link
                  href="/signup"
                  className="inline-flex h-12 items-center gap-3 rounded-full bg-terracotta px-7 text-sm font-medium text-primary-foreground shadow-[0_10px_30px_-12px_rgba(169,83,58,0.6)] transition-colors hover:bg-[#93462f]"
                >
                  {t("organize.cta")}
                  <ArrowRight
                    className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                    strokeWidth={1.5}
                  />
                </Link>
              </div>
            </article>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 border-t border-sand/70 px-6 py-10 text-sm text-stone sm:flex-row sm:px-10">
        <span className="font-serif text-base text-charcoal">AI Wedding Planner</span>
        <span className="font-serif italic">{t("footer")}</span>
      </footer>
    </div>
  );
}

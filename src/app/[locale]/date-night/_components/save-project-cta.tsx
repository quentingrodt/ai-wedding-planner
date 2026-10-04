"use client";

import { ArrowRight, BookOpen, CalendarRange, FileSearch, type LucideIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { DEFAULT_BUDGET_SPLIT } from "@/lib/budget/schema";
import { storeDateNightProject } from "@/lib/date-night/project-storage";
import { DATE_NIGHT_CURRENCY, type DateNightInput } from "@/lib/date-night/schema";
import { DATE_NIGHT_STEPS, type DateNightLikes } from "@/lib/inspiration/catalog";
import { cn } from "@/lib/utils";

const BENEFITS: { key: "timeline" | "book" | "quotes"; icon: LucideIcon }[] = [
  { key: "timeline", icon: CalendarRange },
  { key: "book", icon: BookOpen },
  { key: "quotes", icon: FileSearch },
];

const SEGMENT_TONE = ["bg-terracotta", "bg-sage-deep", "bg-sand"] as const;

type SaveProjectCtaProps = {
  input: DateNightInput;
  /** Coups de cœur du swipe, relayés jusqu'à l'onboarding. */
  likes: DateNightLikes;
};

/**
 * Fin du tunnel Date Night : montre concrètement ce que le compte débloque
 * (budget déjà réparti, carnet, rétroplanning, devis) et pousse à
 * l'inscription. Les montants sont ceux que l'onboarding créera réellement.
 */
export function SaveProjectCta({ input, likes }: SaveProjectCtaProps) {
  const t = useTranslations("DateNight.save");
  const tCategories = useTranslations("Budget.categories");
  const format = useFormatter();
  const money = (value: number) =>
    format.number(value, {
      style: "currency",
      currency: DATE_NIGHT_CURRENCY,
      maximumFractionDigits: 0,
    });

  // Le projet suit l'utilisateur jusqu'à l'onboarding (pré-remplissage).
  const href = {
    pathname: "/signup" as const,
    query: {
      budget: input.budget,
      guests: input.guests,
      style: input.style,
      // Listes « a,b » (format du relais, cf. HANDOFF_KEYS).
      ...Object.fromEntries(
        DATE_NIGHT_STEPS.flatMap((step) => {
          const stepLikes = likes[step];
          return stepLikes?.length ? [[step, stepLikes.join(",")]] : [];
        }),
      ),
    },
  };

  const split = DEFAULT_BUDGET_SPLIT.map(({ category, share }) => ({
    label: tCategories(category),
    share,
    amount: Math.round(input.budget * share),
  }));
  const othersAmount = input.budget - split.reduce((sum, item) => sum + item.amount, 0);

  // Copie de secours dans le navigateur, si le relais par URL se perd en route.
  const projectKey = JSON.stringify(href.query);
  useEffect(() => {
    storeDateNightProject(JSON.parse(projectKey));
  }, [projectKey]);

  // Barre collante sur mobile tant que le bouton principal n'est pas à l'écran.
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const [ctaVisible, setCtaVisible] = useState(true);
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setCtaVisible(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="flex flex-col gap-8 rounded-3xl bg-linen/70 p-6 ring-1 ring-sand/70 sm:p-8">
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
          {t("eyebrow")}
        </p>
        <h2 className="text-3xl leading-tight tracking-tight text-balance sm:text-4xl">
          {t("title")}
        </h2>
        <p className="leading-7 text-stone">{t("body")}</p>
      </div>

      {/* Aperçu tangible : la répartition que l'espace contiendra dès l'inscription */}
      <div className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-[0_20px_50px_-35px_rgba(43,42,40,0.4)]">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-lg">{t("budgetTitle")}</h3>
          <span className="font-serif text-xl tabular-nums">{money(input.budget)}</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-sand/40" aria-hidden>
          {split.map((item, i) => (
            <span
              key={item.label}
              className={cn("h-full", SEGMENT_TONE[i])}
              style={{ width: `${item.share * 100}%` }}
            />
          ))}
        </div>
        <dl className="grid gap-2 text-sm">
          {split.map((item, i) => (
            <div key={item.label} className="flex items-center justify-between gap-4">
              <dt className="flex items-center gap-2 text-stone">
                <span className={cn("size-2 rounded-full", SEGMENT_TONE[i])} aria-hidden />
                {item.label}
              </dt>
              <dd className="tabular-nums">{money(item.amount)}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-2 text-stone">
              <span className="size-2 rounded-full bg-sand/60 ring-1 ring-sand" aria-hidden />
              {t("others")}
            </dt>
            <dd className="tabular-nums">{money(othersAmount)}</dd>
          </div>
        </dl>
        <p className="text-xs text-stone/80">{t("budgetNote")}</p>
      </div>

      <ul className="flex flex-col gap-5">
        {BENEFITS.map(({ key, icon: Icon }) => (
          <li key={key} className="flex gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-terracotta ring-1 ring-sand">
              <Icon className="size-5" strokeWidth={1.25} aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <p className="font-medium">{t(`benefits.${key}.title`)}</p>
              <p className="text-sm leading-6 text-stone">{t(`benefits.${key}.body`)}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col items-center gap-3">
        <Link
          ref={ctaRef}
          href={href}
          className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-terracotta px-8 text-base font-medium text-primary-foreground shadow-[0_14px_34px_-14px_rgba(169,83,58,0.7)] transition-colors hover:bg-[#93462f]"
        >
          {t("cta")}
          <ArrowRight className="size-5" strokeWidth={1.5} aria-hidden />
        </Link>
        <p className="text-center text-xs text-stone">{t("reassurance")}</p>
      </div>

      {/* Mobile : rappel collant, masqué quand le bouton principal est visible */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-sand/70 bg-ivory/95 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-300 sm:hidden",
          ctaVisible ? "translate-y-full" : "translate-y-0",
        )}
        aria-hidden={ctaVisible}
      >
        <Link
          href={href}
          tabIndex={ctaVisible ? -1 : undefined}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-terracotta text-sm font-medium text-primary-foreground"
        >
          {t("cta")}
          <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
        </Link>
      </div>
    </section>
  );
}

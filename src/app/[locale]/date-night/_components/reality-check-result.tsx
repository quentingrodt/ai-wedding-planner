"use client";

import { ArrowRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  DATE_NIGHT_CURRENCY,
  type Feasibility,
  type FeasibilityVerdict,
  type RealityCheckInsight,
} from "@/lib/date-night/schema";

const VERDICT_TONE: Record<FeasibilityVerdict, string> = {
  comfortable: "bg-sage-soft text-sage-deep",
  tight: "bg-sand/70 text-charcoal",
  challenging: "bg-terracotta-soft text-terracotta",
};

type RealityCheckResultProps = {
  feasibility: Feasibility;
  insight: RealityCheckInsight;
};

export function RealityCheckResult({
  feasibility,
  insight,
}: RealityCheckResultProps) {
  const t = useTranslations("DateNight.result");
  const format = useFormatter();
  const money = (value: number) =>
    format.number(value, {
      style: "currency",
      currency: DATE_NIGHT_CURRENCY,
      maximumFractionDigits: 0,
    });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-8 duration-700">
      <article className="flex flex-col gap-6 rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8">
        <span
          className={cn(
            "self-start rounded-full px-3 py-1 text-xs font-medium tracking-wide uppercase",
            VERDICT_TONE[feasibility.verdict],
          )}
        >
          {t(`verdicts.${feasibility.verdict}`)}
        </span>

        <div className="flex flex-col gap-3">
          <h2 className="text-2xl leading-snug sm:text-3xl">
            {insight.headline}
          </h2>
          <p className="leading-7 text-muted-foreground">{insight.summary}</p>
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-2xl bg-sage-soft/60 p-4">
            <dt className="text-xs text-sage-deep">{t("yourBudgetPerGuest")}</dt>
            <dd className="font-serif text-2xl tabular-nums">
              {money(feasibility.budgetPerGuest)}
            </dd>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl bg-linen p-4">
            <dt className="text-xs text-stone">{t("marketPerGuest")}</dt>
            <dd className="font-serif text-2xl tabular-nums">
              {money(feasibility.marketPerGuest)}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-4">
          <h3 className="text-lg">{t("tipsTitle")}</h3>
          <ol className="flex flex-col gap-4">
            {insight.tips.map((tip, index) => (
              <li key={tip.title} className="flex gap-4">
                <span
                  aria-hidden
                  className="w-5 shrink-0 font-serif text-2xl leading-none text-terracotta"
                >
                  {index + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <p className="font-medium">{tip.title}</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {tip.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
      </article>

      <Button
        asChild
        size="lg"
        className="h-auto min-h-14 rounded-2xl px-6 py-4 text-base whitespace-normal shadow-sm"
      >
        <Link href="/login">
          {t("cta")}
          <ArrowRight data-icon="inline-end" className="size-5" />
        </Link>
      </Button>
    </div>
  );
}

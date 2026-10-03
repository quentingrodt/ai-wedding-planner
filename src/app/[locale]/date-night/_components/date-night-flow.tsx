"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  BUDGET_RANGE,
  DATE_NIGHT_CURRENCY,
  GUESTS_RANGE,
} from "@/lib/date-night/schema";
import { AnalysisSkeleton } from "./analysis-skeleton";
import { RealityCheckResult } from "./reality-check-result";
import { SliderField } from "./slider-field";
import { StylePicker } from "./style-picker";
import { useDateNight } from "./use-date-night";

/** Assemble le tunnel : la logique vient de useDateNight, le rendu des sous-composants. */
export function DateNightFlow() {
  const t = useTranslations("DateNight");
  const format = useFormatter();
  const {
    style,
    budget,
    guests,
    result,
    isAnalyzing,
    canAnalyze,
    setStyle,
    setBudget,
    setGuests,
    analyze,
  } = useDateNight();

  const money = (value: number) =>
    format.number(value, {
      style: "currency",
      currency: DATE_NIGHT_CURRENCY,
      maximumFractionDigits: 0,
    });

  // Sur mobile, le résultat apparaît sous la ligne de flottaison : on l'amène à l'écran.
  const resultRef = useRef<HTMLDivElement>(null);
  const hasOutcome = isAnalyzing || result !== null;
  useEffect(() => {
    if (!hasOutcome) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    resultRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [hasOutcome, isAnalyzing]);

  return (
    <div className="flex flex-col gap-12">
      <StylePicker value={style} onChange={setStyle} disabled={isAnalyzing} />

      <section className="flex flex-col gap-10">
        <SliderField
          label={t("budget.label")}
          displayValue={money(budget)}
          minLabel={money(BUDGET_RANGE.min)}
          maxLabel={money(BUDGET_RANGE.max)}
          value={budget}
          min={BUDGET_RANGE.min}
          max={BUDGET_RANGE.max}
          step={BUDGET_RANGE.step}
          onChange={setBudget}
          disabled={isAnalyzing}
        />
        <SliderField
          label={t("guests.label")}
          displayValue={t("guests.value", { count: guests })}
          minLabel={format.number(GUESTS_RANGE.min)}
          maxLabel={format.number(GUESTS_RANGE.max)}
          value={guests}
          min={GUESTS_RANGE.min}
          max={GUESTS_RANGE.max}
          step={GUESTS_RANGE.step}
          onChange={setGuests}
          disabled={isAnalyzing}
        />
      </section>

      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          onClick={analyze}
          disabled={!canAnalyze}
          className="h-14 rounded-2xl text-base"
        >
          {t("analyze")}
        </Button>
        {!style && (
          <p className="text-center text-sm text-muted-foreground">
            {t("pickStyleHint")}
          </p>
        )}
      </div>

      <div ref={resultRef} className="scroll-mt-6">
        {isAnalyzing && <AnalysisSkeleton />}
        {!isAnalyzing && result?.status === "success" && (
          <RealityCheckResult
            input={result.input}
            feasibility={result.feasibility}
            insight={result.insight}
          />
        )}
        {!isAnalyzing && result?.status === "error" && (
          <p role="alert" className="text-center text-sm text-destructive">
            {t(`errors.${result.code}`)}
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import { useFormatter, useMessages, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { BUDGET_RANGE, DATE_NIGHT_CURRENCY, GUESTS_RANGE } from "@/lib/date-night/schema";
import {
  DATE_NIGHT_STEPS,
  type DateNightLikes,
  type DateNightStep,
  type InspirationOption,
} from "@/lib/inspiration/catalog";
import { INSPIRATION_PHOTOS } from "@/lib/inspiration/photos";
import { AnalysisSkeleton } from "./analysis-skeleton";
import { RealityCheckResult } from "./reality-check-result";
import { SliderField } from "./slider-field";
import { SwipeDeck } from "./swipe-deck";
import { useDateNight } from "./use-date-night";

/**
 * Assemble le tunnel : la logique vient de useDateNight, le rendu des
 * sous-composants. D'abord le swipe d'inspiration (lieu, cérémonie, repas),
 * puis budget et invités, et enfin le Reality Check.
 */
export function DateNightFlow() {
  const t = useTranslations("DateNight");
  const format = useFormatter();
  const tSteps = useTranslations("Inspiration.steps");
  const {
    likes,
    currentStep,
    budget,
    guests,
    result,
    isAnalyzing,
    canAnalyze,
    completeStep,
    restartInspiration,
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

  // Changement d'étape : on revient en haut du tunnel.
  const step = currentStep ?? "details";
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }, [step]);

  if (currentStep !== null) {
    const position = DATE_NIGHT_STEPS.indexOf(currentStep);
    return (
      <div className="flex flex-col gap-8">
        <FlowHeader
          eyebrow={`${t("eyebrow")} · ${tSteps(`${currentStep}.label`)}`}
          title={tSteps(`${currentStep}.title`)}
          intro={tSteps(`${currentStep}.subtitle`)}
          progress={{ current: position + 1, total: DATE_NIGHT_STEPS.length }}
        />
        {/* key : un paquet neuf (index, coups de cœur) à chaque étape */}
        <SwipeDeck
          key={currentStep}
          step={currentStep}
          requireLike={currentStep === "venue"}
          onComplete={(stepLikes: InspirationOption<typeof currentStep>[]) =>
            completeStep(currentStep, stepLikes)
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <FlowHeader eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} />
      <InspirationSummary likes={likes} onEdit={restartInspiration} disabled={isAnalyzing} />

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
      </div>

      <div ref={resultRef} className="scroll-mt-6">
        {isAnalyzing && <AnalysisSkeleton />}
        {!isAnalyzing && result?.status === "success" && (
          <RealityCheckResult
            input={result.input}
            likes={likes}
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

function FlowHeader({
  eyebrow,
  title,
  intro,
  progress,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  progress?: { current: number; total: number };
}) {
  const t = useTranslations("DateNight");

  return (
    <header className="flex flex-col gap-4">
      <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">{eyebrow}</p>
      {progress && (
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={progress.total}
          aria-valuenow={progress.current}
          aria-valuetext={t("swipe.progress", progress)}
          className="flex gap-1.5"
        >
          {Array.from({ length: progress.total }, (_, i) => (
            <span
              key={i}
              className={`h-0.5 flex-1 rounded-full transition-colors duration-500 ${
                i < progress.current ? "bg-terracotta" : "bg-sand"
              }`}
            />
          ))}
        </div>
      )}
      <h1 className="text-4xl leading-tight tracking-tight text-balance sm:text-5xl">{title}</h1>
      <p className="text-lg leading-8 text-muted-foreground">{intro}</p>
    </header>
  );
}

/** Rappel des coups de cœur à l'étape budget, avec retour possible au swipe. */
function InspirationSummary({
  likes,
  onEdit,
  disabled,
}: {
  likes: DateNightLikes;
  onEdit: () => void;
  disabled: boolean;
}) {
  const t = useTranslations("DateNight");
  const tSteps = useTranslations("Inspiration.steps");
  const optionTexts = useMessages().Inspiration.options;

  return (
    <section className="flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-border">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xs font-medium tracking-[0.2em] text-stone uppercase">
          {t("summary.label")}
        </h2>
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className="text-sm text-stone underline decoration-sand underline-offset-4 transition-colors hover:text-charcoal hover:decoration-terracotta disabled:opacity-50"
        >
          {t("summary.edit")}
        </button>
      </div>
      <dl className="flex flex-col gap-4">
        {DATE_NIGHT_STEPS.map((step) => (
          <SummaryRow
            key={step}
            step={step}
            label={tSteps(`${step}.label`)}
            options={likes[step] ?? []}
            names={optionTexts[step] as Record<string, { name: string }>}
            none={t("summary.none")}
          />
        ))}
      </dl>
    </section>
  );
}

function SummaryRow({
  step,
  label,
  options,
  names,
  none,
}: {
  step: DateNightStep;
  label: string;
  options: readonly string[];
  names: Record<string, { name: string }>;
  none: string;
}) {
  const photos = INSPIRATION_PHOTOS[step] as Record<string, { src: string }>;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
      <dt className="w-28 shrink-0 text-sm text-stone">{label}</dt>
      <dd className="flex flex-wrap gap-2">
        {options.length === 0 && <span className="text-sm text-stone/70 italic">{none}</span>}
        {options.map((option) => (
          <span
            key={option}
            className="inline-flex items-center gap-2 rounded-full bg-linen py-1 pr-3.5 pl-1 text-sm"
          >
            <span className="relative size-7 overflow-hidden rounded-full">
              <Image src={photos[option].src} alt="" fill sizes="28px" className="object-cover" />
            </span>
            {names[option].name}
          </span>
        ))}
      </dd>
    </div>
  );
}

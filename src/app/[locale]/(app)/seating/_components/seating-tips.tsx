"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Conseils de placement, dans l'ordre où on les découvre. */
const TIPS = [
  "interactions",
  "inclusion",
  "singles",
  "conflicts",
  "children",
  "generations",
  "comfort",
  "flexibility",
] as const;

/** Ampoule au trait : le signe d'une astuce. */
function LightbulbDrawing() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-11 shrink-0">
      <circle cx={24} cy={24} r={23} className="fill-sage-soft" />
      <g className="fill-none stroke-sage-deep" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
        {/* Globe, culot et filament. */}
        <path d="M18.5 28.5 C15.5 26 14.5 22.5 15.5 19.5 C17 15 21 13 24 13 C27 13 31 15 32.5 19.5 C33.5 22.5 32.5 26 29.5 28.5 C28.5 29.4 28 30.5 28 31.5 L20 31.5 C20 30.5 19.5 29.4 18.5 28.5 Z" />
        <path d="M20.5 34.5 H27.5 M21.5 37.5 H26.5" />
        <path d="M21.5 31.5 V26 L24 23.5 L26.5 26 V31.5" />
        {/* Rayons. */}
        <path d="M24 6.5 V9 M11.5 11.5 L13.3 13.3 M36.5 11.5 L34.7 13.3 M7 23 H9.5 M41 23 H38.5" />
      </g>
    </svg>
  );
}

/** Encart discret d'astuces pour composer un plan de table réussi, une à la fois. */
export function SeatingTips() {
  const t = useTranslations("Seating.tips");
  const [index, setIndex] = useState(0);
  const tip = TIPS[index];
  const step = (delta: number) => setIndex((current) => (current + delta + TIPS.length) % TIPS.length);

  return (
    <section aria-labelledby="seating-tips-title" className="flex flex-col gap-3 rounded-3xl bg-card p-5 ring-1 ring-border">
      <div className="flex items-center gap-3">
        <LightbulbDrawing />
        <div className="flex min-w-0 flex-col">
          <h2 id="seating-tips-title" className="text-xs font-medium tracking-[0.2em] text-sage-deep uppercase">
            {t("eyebrow")}
          </h2>
          <p className="font-serif text-lg leading-snug">{t(`items.${tip}.title`)}</p>
        </div>
      </div>
      <p aria-live="polite" className="text-sm leading-6 text-pretty text-stone">
        {t(`items.${tip}.body`)}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-stone tabular-nums">
          {t("position", { current: index + 1, total: TIPS.length })}
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("previous")}
            onClick={() => step(-1)}
            className="rounded-full text-stone"
          >
            <ChevronLeftIcon aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("next")}
            onClick={() => step(1)}
            className="rounded-full text-stone"
          >
            <ChevronRightIcon aria-hidden />
          </Button>
        </div>
      </div>
    </section>
  );
}

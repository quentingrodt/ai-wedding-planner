"use client";

import { useTranslations } from "next-intl";
import { RATING_MAX } from "@/lib/venues/catalog";
import { cn } from "@/lib/utils";

const STEPS = Array.from({ length: RATING_MAX }, (_, index) => index + 1);

/** Note de 1 à 5 en pastilles, lecture seule. */
export function RatingDots({ value, className }: { value: number | null; className?: string }) {
  const t = useTranslations("Compare");
  if (value === null) return <span className={cn("text-xs text-stone", className)}>{t("rating.none")}</span>;
  return (
    <span
      role="img"
      aria-label={t("rating.value", { value, max: RATING_MAX })}
      className={cn("inline-flex items-center gap-1", className)}
    >
      {STEPS.map((step) => (
        <span key={step} className={cn("size-2 rounded-full", step <= value ? "bg-sage-deep" : "bg-sand")} />
      ))}
    </span>
  );
}

/** Saisie d'une note : cliquer sur la note choisie la retire. */
export function RatingInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const t = useTranslations("Compare");
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1.5">
      {STEPS.map((step) => (
        <button
          key={step}
          type="button"
          role="radio"
          aria-checked={value === step}
          aria-label={t(`rating.steps.${step as 1 | 2 | 3 | 4 | 5}`)}
          title={t(`rating.steps.${step as 1 | 2 | 3 | 4 | 5}`)}
          onClick={() => onChange(value === step ? null : step)}
          className={cn(
            "size-7 rounded-full ring-1 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            value !== null && step <= value
              ? "bg-sage-deep ring-sage-deep"
              : "bg-card ring-border hover:bg-sage-soft",
          )}
        />
      ))}
    </div>
  );
}

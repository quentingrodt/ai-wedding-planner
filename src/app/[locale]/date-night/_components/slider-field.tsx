"use client";

import { useId } from "react";
import { Slider } from "@/components/ui/slider";

type SliderFieldProps = {
  label: string;
  /** Valeur déjà formatée pour l'affichage (devise, pluriel…). */
  displayValue: string;
  minLabel: string;
  maxLabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

export function SliderField({
  label,
  displayValue,
  minLabel,
  maxLabel,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
}: SliderFieldProps) {
  const labelId = useId();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span id={labelId} className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        {/* Déjà annoncé via aria-valuetext sur le thumb : masqué pour ne pas doubler. */}
        <span
          aria-hidden
          className="font-serif text-3xl tabular-nums text-foreground"
        >
          {displayValue}
        </span>
      </div>
      <Slider
        aria-labelledby={labelId}
        thumbAriaValueText={displayValue}
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([next]) => onChange(next)}
        className="py-2 **:data-[slot=slider-range]:bg-sage **:data-[slot=slider-thumb]:size-6 **:data-[slot=slider-thumb]:border-sage **:data-[slot=slider-thumb]:shadow-sm **:data-[slot=slider-track]:data-horizontal:h-1.5 **:data-[slot=slider-track]:bg-linen"
      />
      <div
        aria-hidden
        className="flex justify-between text-xs text-muted-foreground"
      >
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

"use client";

import { Castle, Factory, Trees, Waves, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { WEDDING_STYLES, type WeddingStyle } from "@/lib/date-night/schema";

const STYLE_VISUALS: Record<WeddingStyle, { icon: LucideIcon; tint: string }> =
  {
    chateau: { icon: Castle, tint: "from-sand to-linen text-charcoal" },
    countryside: { icon: Trees, tint: "from-sage-soft to-sand/60 text-sage-deep" },
    beach: { icon: Waves, tint: "from-sage-soft to-linen text-sage-deep" },
    urban: { icon: Factory, tint: "from-terracotta-soft to-linen text-terracotta" },
  };

type StylePickerProps = {
  value: WeddingStyle | null;
  onChange: (style: WeddingStyle) => void;
  disabled?: boolean;
};

export function StylePicker({ value, onChange, disabled }: StylePickerProps) {
  const t = useTranslations("Onboarding");
  const tVenue = useTranslations("Inspiration.options.venue");

  return (
    <fieldset className="flex flex-col gap-4" disabled={disabled}>
      <legend className="mb-4 font-serif text-2xl">{t("styleLegend")}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {WEDDING_STYLES.map((style) => {
          const { icon: Icon, tint } = STYLE_VISUALS[style];
          const selected = value === style;

          return (
            <label
              key={style}
              className={cn(
                "group relative flex cursor-pointer items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-border transition-all sm:flex-col sm:items-start sm:p-5",
                "hover:ring-sand has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                "has-disabled:cursor-not-allowed has-disabled:opacity-60",
                selected && "ring-2 ring-primary hover:ring-primary",
              )}
            >
              <input
                type="radio"
                name="wedding-style"
                value={style}
                checked={selected}
                onChange={() => onChange(style)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "flex size-16 shrink-0 items-center justify-center rounded-xl bg-linear-to-br sm:aspect-4/3 sm:h-auto sm:w-full",
                  tint,
                )}
              >
                <Icon className="size-7 stroke-[1.25] sm:size-9" />
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-serif text-lg leading-snug">
                  {tVenue(`${style}.name`)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {tVenue(`${style}.description`)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

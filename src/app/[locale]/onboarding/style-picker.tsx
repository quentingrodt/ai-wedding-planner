"use client";

import { Check } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { WEDDING_STYLES, type WeddingStyle } from "@/lib/date-night/schema";
import { INSPIRATION_PHOTOS } from "@/lib/inspiration/photos";

type StylePickerProps = {
  value: WeddingStyle | null;
  onChange: (style: WeddingStyle) => void;
  disabled?: boolean;
};

/** Choix de l'ambiance de lieu, avec les mêmes photos que le swipe Date Night. */
export function StylePicker({ value, onChange, disabled }: StylePickerProps) {
  const t = useTranslations("Onboarding");
  const tVenue = useTranslations("Inspiration.options.venue");

  return (
    <fieldset className="flex flex-col gap-4" disabled={disabled}>
      <legend className="mb-4 font-serif text-2xl">{t("styleLegend")}</legend>
      <div className="grid grid-cols-2 gap-3">
        {WEDDING_STYLES.map((style) => {
          const selected = value === style;

          return (
            <label
              key={style}
              className={cn(
                "group relative flex aspect-[4/5] cursor-pointer overflow-hidden rounded-2xl ring-1 ring-border transition-all sm:aspect-[4/3]",
                "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                "has-disabled:cursor-not-allowed has-disabled:opacity-60",
                selected ? "ring-3 ring-terracotta" : "hover:ring-sand",
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
              <Image
                src={INSPIRATION_PHOTOS.venue[style].src}
                alt=""
                fill
                sizes="(max-width: 640px) 45vw, 320px"
                className={cn(
                  "object-cover transition duration-700 group-hover:scale-[1.03]",
                  value !== null && !selected && "opacity-80 grayscale-[35%]",
                )}
              />
              <span
                aria-hidden
                className="absolute inset-0 bg-linear-to-t from-charcoal/80 via-charcoal/20 to-transparent"
              />
              {selected && (
                <span className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full bg-terracotta text-ivory">
                  <Check className="size-4" strokeWidth={2} aria-hidden />
                </span>
              )}
              <span className="relative mt-auto flex flex-col gap-1 p-4 text-ivory">
                <span className="font-serif text-xl leading-tight">{tVenue(`${style}.name`)}</span>
                <span className="hidden text-xs leading-5 text-ivory/80 sm:block">
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

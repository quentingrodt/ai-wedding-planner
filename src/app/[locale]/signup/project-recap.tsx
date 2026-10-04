import { Check } from "lucide-react";
import Image from "next/image";
import { getFormatter, getTranslations } from "next-intl/server";
import { DATE_NIGHT_CURRENCY } from "@/lib/date-night/schema";
import { INSPIRATION_PHOTOS } from "@/lib/inspiration/photos";
import type { Handoff } from "@/lib/onboarding/schema";

/** Le projet Date Night a-t-il de quoi être rappelé à l'inscription ? */
export function hasProject(handoff: Handoff) {
  return handoff.budget !== undefined || (handoff.venue ?? handoff.style) !== undefined;
}

/** Rappel du projet Date Night au-dessus du formulaire d'inscription. */
export async function ProjectRecap({ handoff }: { handoff: Handoff }) {
  const t = await getTranslations("Auth.signup.project");
  const tOptions = await getTranslations("Inspiration.options");
  const format = await getFormatter();

  const venue = handoff.venue?.[0] ?? handoff.style;
  const ceremonies = handoff.ceremony?.map((c) => tOptions(`ceremony.${c}.name`)) ?? [];

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border">
      {venue && (
        <div className="relative aspect-[2/1]">
          <Image
            src={INSPIRATION_PHOTOS.venue[venue].src}
            alt=""
            fill
            sizes="384px"
            loading="eager"
            className="object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-linear-to-t from-charcoal/75 via-charcoal/10 to-transparent"
          />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-4 text-ivory">
            <span className="text-xs tracking-[0.2em] text-ivory/80 uppercase">{t("label")}</span>
            <span className="font-serif text-2xl leading-tight">
              {tOptions(`venue.${venue}.name`)}
            </span>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2 p-4 text-sm">
        {handoff.budget !== undefined && (
          <p className="flex justify-between gap-4">
            <span className="text-stone">{t("budget")}</span>
            <span className="tabular-nums">
              {format.number(handoff.budget, {
                style: "currency",
                currency: DATE_NIGHT_CURRENCY,
                maximumFractionDigits: 0,
              })}
            </span>
          </p>
        )}
        {(handoff.guests !== undefined || ceremonies.length > 0) && (
          <p className="text-stone">
            {[
              ...(handoff.guests !== undefined ? [t("guests", { count: handoff.guests })] : []),
              ...ceremonies,
            ].join(" · ")}
          </p>
        )}
      </div>
      <p className="flex items-start gap-2 border-t border-border px-4 py-3 text-xs leading-5 text-sage-deep">
        <Check className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden />
        {t("kept")}
      </p>
    </section>
  );
}

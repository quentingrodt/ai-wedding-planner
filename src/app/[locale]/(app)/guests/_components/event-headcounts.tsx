"use client";

import { useTranslations } from "next-intl";
import { GUEST_EVENTS, type EventHeadcount, type GuestEvent } from "@/lib/guests/schema";
import { cn } from "@/lib/utils";

type EventHeadcountsProps = {
  counts: Record<GuestEvent, EventHeadcount>;
  /** Étape qui filtre la liste, ou null. */
  selected: GuestEvent | null;
  onSelect: (event: GuestEvent | null) => void;
};

/**
 * Combien de personnes à chaque étape : les chiffres que demandent le traiteur
 * et les lieux. Un clic sur une étape filtre la liste.
 */
export function EventHeadcounts({ counts, selected, onSelect }: EventHeadcountsProps) {
  const t = useTranslations("Guests");

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium tracking-[0.15em] text-stone uppercase">
        {t("headcounts.title")}
      </h2>
      <div
        role="group"
        aria-label={t("headcounts.title")}
        className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0"
      >
        {GUEST_EVENTS.map((event) => {
          const { expected, confirmed } = counts[event];
          const active = selected === event;
          return (
            <button
              key={event}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(active ? null : event)}
              className={cn(
                "flex min-w-32 shrink-0 snap-start flex-col gap-0.5 rounded-2xl px-4 py-3 text-left ring-1 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                active
                  ? "bg-sage-soft ring-sage/50"
                  : "bg-card ring-border hover:bg-linen/50",
              )}
            >
              <span className="text-sm text-stone">{t(`events.${event}`)}</span>
              <span className="font-serif text-2xl text-charcoal tabular-nums">{expected}</span>
              <span className="text-xs text-stone">
                {t("headcounts.confirmed", { count: confirmed })}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

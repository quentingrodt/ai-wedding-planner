"use client";

import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { destinationsFor, GOWN_GUIDE, HONEYMOON_DESTINATIONS } from "@/lib/vendors/tools";
import { PlanCard } from "./plan-card";

/** Voyage de noces : les destinations et leur meilleure saison, celles du mois de départ en tête. */
export function HoneymoonGuide({ month }: { month: number }) {
  const t = useTranslations("Vendors.tools.honeymoon");
  const format = useFormatter();
  const monthName = format.dateTime(new Date(Date.UTC(2000, month - 1, 1)), { month: "long", timeZone: "UTC" });
  const ideal = destinationsFor(month);
  const ordered = [
    ...HONEYMOON_DESTINATIONS.filter((destination) => ideal.includes(destination.key)),
    ...HONEYMOON_DESTINATIONS.filter((destination) => !ideal.includes(destination.key)),
  ];

  return (
    <PlanCard
      title={t("title")}
      lead={ideal.length > 0 ? t("lead", { month: monthName }) : t("leadNoMatch", { month: monthName })}
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {ordered.map((destination) => {
          const best = ideal.includes(destination.key);
          return (
            <li
              key={destination.key}
              className={cn(
                "flex flex-col gap-1 rounded-2xl p-4 ring-1",
                best ? "bg-sage-soft/60 ring-sage/50" : "bg-card ring-border",
              )}
            >
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-serif text-lg">{t(`destinations.${destination.key}.name`)}</span>
                {best && <span className="text-xs text-sage-deep">{t("ideal", { month: monthName })}</span>}
              </span>
              <span className="text-sm text-stone">{t(`destinations.${destination.key}.season`)}</span>
            </li>
          );
        })}
      </ul>
    </PlanCard>
  );
}

/** Robe de mariée : les cinq grandes coupes, à qui elles vont, ce qu'elles apportent. */
export function GownGuide() {
  const t = useTranslations("Vendors.tools.gown");
  return (
    <PlanCard title={t("title")} lead={t("lead")}>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GOWN_GUIDE.map((shape) => (
          <li key={shape} className="flex flex-col gap-2 rounded-2xl bg-linen/60 p-4">
            <span className="font-serif text-lg">{t(`items.${shape}.name`)}</span>
            <span className="text-sm">
              <span className="text-stone">{t("forWho")} · </span>
              {t(`items.${shape}.forWho`)}
            </span>
            <span className="text-sm">
              <span className="text-stone">{t("advice")} · </span>
              {t(`items.${shape}.advice`)}
            </span>
          </li>
        ))}
      </ul>
    </PlanCard>
  );
}

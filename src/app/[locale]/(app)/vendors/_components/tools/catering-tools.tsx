"use client";

import { useTranslations } from "next-intl";
import type { PlanOf } from "@/lib/vendors/plans";
import {
  COCKTAIL_PARTS,
  DRINKS,
  drinkQuantity,
  MENU_COURSES,
  STATION_IDEAS,
  type DrinkKey,
} from "@/lib/vendors/tools";
import { PlanCard, textareaClass, toggle, ToggleChip, usePlan } from "./plan-card";

/** Traiteur : boissons à prévoir, menu, vin d'honneur et stands. */
export function CateringTools({ initial, guestCount }: { initial: PlanOf<"catering">; guestCount: number | null }) {
  const t = useTranslations("Vendors.tools");
  const { plan, setPlan, dirty, pending, save } = usePlan("catering", initial);
  const saveProps = { dirty, pending, onSave: save };

  const quantity = (key: DrinkKey, unit: (typeof DRINKS)[number]["unit"]) => {
    const { min, max } = drinkQuantity(key, guestCount ?? 0);
    if (unit === "units") return t("drinks.units", { min });
    if (unit === "litres") return t("drinks.litres", { min });
    return min === max ? t("drinks.bottles", { min }) : t("drinks.bottlesRange", { min, max });
  };

  return (
    <div className="flex flex-col gap-4">
      <PlanCard
        title={t("drinks.title")}
        lead={guestCount ? t("drinks.lead", { count: guestCount }) : t("noGuests")}
        {...saveProps}
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {DRINKS.map((drink) => {
            const served = plan.drinks.includes(drink.key);
            return (
              <li key={drink.key}>
                <label
                  className={
                    "flex h-full cursor-pointer items-start gap-3 rounded-2xl p-3 ring-1 transition-colors " +
                    (served ? "bg-sage-soft/50 ring-sage/50" : "bg-card ring-border hover:bg-linen/50")
                  }
                >
                  <input
                    type="checkbox"
                    checked={served}
                    onChange={() => setPlan({ ...plan, drinks: toggle(plan.drinks, drink.key) })}
                    className="mt-1 size-4 shrink-0 accent-sage-deep"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-medium">{t(`drinks.items.${drink.key}`)}</span>
                      {served && guestCount ? (
                        <span className="font-serif text-lg text-sage-deep tabular-nums">{quantity(drink.key, drink.unit)}</span>
                      ) : null}
                    </span>
                    <span className="text-xs text-stone">{t(`drinks.rules.${drink.key}`)}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-stone">{t("drinks.note")}</p>
      </PlanCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <PlanCard title={t("menu.title")} {...saveProps}>
          <div className="flex flex-col gap-3">
            {MENU_COURSES.map((course) => (
              <label key={course} className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t(`menu.courses.${course}`)}</span>
                <textarea
                  value={plan.menu[course] ?? ""}
                  maxLength={400}
                  rows={2}
                  onChange={(event) => setPlan({ ...plan, menu: { ...plan.menu, [course]: event.target.value } })}
                  className={textareaClass}
                />
              </label>
            ))}
          </div>
        </PlanCard>

        <div className="flex flex-col gap-4">
          <PlanCard title={t("cocktail.title")} {...saveProps}>
            <div className="flex flex-col gap-3">
              {COCKTAIL_PARTS.map((part) => (
                <label key={part} className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{t(`cocktail.parts.${part}`)}</span>
                  <textarea
                    value={plan.cocktail[part] ?? ""}
                    maxLength={600}
                    rows={3}
                    onChange={(event) =>
                      setPlan({ ...plan, cocktail: { ...plan.cocktail, [part]: event.target.value } })
                    }
                    className={textareaClass}
                  />
                </label>
              ))}
            </div>
          </PlanCard>

          <PlanCard title={t("stations.title")} lead={t("stations.lead")} {...saveProps}>
            <div className="flex flex-wrap gap-2">
              {STATION_IDEAS.map((idea) => (
                <ToggleChip
                  key={idea}
                  pressed={plan.stations.includes(idea)}
                  onClick={() => setPlan({ ...plan, stations: toggle(plan.stations, idea) })}
                >
                  {t(`stations.ideas.${idea}`)}
                </ToggleChip>
              ))}
            </div>
          </PlanCard>
        </div>
      </div>
    </div>
  );
}

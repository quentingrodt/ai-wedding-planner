"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanOf } from "@/lib/vendors/plans";
import { CAKE_TIERS, cakePortions, suggestCakeTiers, type CakeShape } from "@/lib/vendors/tools";
import { PlanCard, toggle, ToggleChip, usePlan } from "./plan-card";

/** Pièce montée : forme et étages, et le nombre de parts face aux invités. */
export function CakeTools({ initial, guestCount }: { initial: PlanOf<"cake">; guestCount: number | null }) {
  const t = useTranslations("Vendors.tools");
  const format = useFormatter();
  const { plan, setPlan, dirty, pending, save } = usePlan("cake", initial);
  const portions = cakePortions(plan.tiers, plan.shape);
  const suggestion = guestCount ? suggestCakeTiers(guestCount, plan.shape) : [];
  const suggestionMatches =
    suggestion.length === plan.tiers.length && suggestion.every((size) => plan.tiers.includes(size));
  // Le plus grand étage en bas : la pile se dessine du haut vers le bas.
  const widest = Math.max(...CAKE_TIERS.map((tier) => tier.size));

  return (
    <PlanCard title={t("cake.title")} lead={t("cake.lead")} dirty={dirty} pending={pending} onSave={save}>
      <div className="flex flex-wrap gap-2">
        {(["round", "square"] as const satisfies readonly CakeShape[]).map((shape) => (
          <ToggleChip key={shape} pressed={plan.shape === shape} onClick={() => setPlan({ ...plan, shape })}>
            {t(`cake.shapes.${shape}`)}
          </ToggleChip>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-[1fr_14rem]">
        <ul className="flex flex-col gap-1.5">
          {CAKE_TIERS.map((tier) => {
            const chosen = plan.tiers.includes(tier.size);
            return (
              <li key={tier.size}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 ring-1 transition-colors",
                    chosen ? "bg-sage-soft/50 ring-sage/50" : "bg-card ring-border hover:bg-linen/50",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={chosen}
                      onChange={() =>
                        setPlan({ ...plan, tiers: toggle(plan.tiers, tier.size).sort((a, b) => a - b) })
                      }
                      className="size-4 accent-sage-deep"
                    />
                    {t("cake.tier", { size: tier.size })}
                  </span>
                  <span className="text-sm text-stone tabular-nums">{t("cake.portions", { count: tier[plan.shape] })}</span>
                </label>
              </li>
            );
          })}
        </ul>

        {/* Silhouette de la pièce montée choisie. */}
        <div aria-hidden className="flex min-h-40 flex-col items-center justify-end gap-1 rounded-2xl bg-linen/60 p-4">
          {plan.tiers.map((size) => (
            <div
              key={size}
              className={cn("h-6 bg-sage/70", plan.shape === "round" ? "rounded-lg" : "rounded-sm")}
              style={{ width: `${(size / widest) * 100}%` }}
            />
          ))}
        </div>
      </div>

      {plan.tiers.length > 0 && (
        <p className="text-sm text-charcoal">
          {guestCount
            ? t("cake.total", { portions, guests: guestCount })
            : t("cake.portions", { count: portions })}
          {guestCount ? (
            <span className={portions >= guestCount ? "text-sage-deep" : "text-terracotta"}>
              {" "}
              {portions >= guestCount ? t("cake.enough") : t("cake.short", { count: guestCount - portions })}
            </span>
          ) : null}
        </p>
      )}

      {suggestion.length > 0 && !suggestionMatches && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-sage-soft/50 px-4 py-3 text-sm">
          <span className="text-charcoal">
            {t("cake.suggest", {
              tiers: format.list(suggestion.map((size) => t("cake.tier", { size }))),
            })}
          </span>
          <Button variant="outline" size="sm" className="rounded-full bg-card" onClick={() => setPlan({ ...plan, tiers: suggestion })}>
            {t("cake.apply")}
          </Button>
        </div>
      )}
    </PlanCard>
  );
}

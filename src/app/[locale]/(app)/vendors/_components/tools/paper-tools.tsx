"use client";

import { CheckIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PlanOf } from "@/lib/vendors/plans";
import {
  GIFT_IDEAS,
  STATIONERY_ITEMS,
  suggestedQuantity,
  WEBSITE_ELEMENTS,
  type WebsiteElement,
} from "@/lib/vendors/tools";
import { onlyDigits } from "../vendor-form-sections";
import { PlanCard, toggle, ToggleChip, usePlan } from "./plan-card";

const cell = "h-9 min-w-0 rounded-lg bg-card text-sm";

/** Papeterie : chaque article, ses caractéristiques, sa quantité, son coût et sa date de réception. */
export function StationeryTools({
  initial,
  context,
  currency,
}: {
  initial: PlanOf<"stationery">;
  context: { households: number; guests: number; tables: number };
  currency: string;
}) {
  const t = useTranslations("Vendors.tools.stationery");
  const format = useFormatter();
  const { plan, setPlan, dirty, pending, save } = usePlan("stationery", initial);
  const total = STATIONERY_ITEMS.reduce((sum, item) => sum + (plan.items[item]?.cost ?? 0), 0);
  const patch = (item: string, value: Record<string, unknown>) =>
    setPlan({ ...plan, items: { ...plan.items, [item]: { ...plan.items[item], ...value } } });
  const number = (value: string, length: number) => {
    const parsed = Number.parseInt(onlyDigits(value, length), 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return (
    <PlanCard title={t("title")} lead={t("lead")} dirty={dirty} pending={pending} onSave={save}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-stone">
              {(["item", "spec", "quantity", "cost", "receivedOn"] as const).map((column) => (
                <th key={column} scope="col" className="px-1 pb-2 font-normal">{t(`columns.${column}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STATIONERY_ITEMS.map((item) => {
              const row = plan.items[item] ?? {};
              const suggested = suggestedQuantity(item, context);
              return (
                <tr key={item} className="border-t border-border/60 align-top">
                  <th scope="row" className="w-44 px-1 py-2 text-left font-normal">
                    <span className="block">{t(`items.${item}`)}</span>
                    {suggested !== null && (
                      <span className="text-xs text-stone">{t("suggested", { count: suggested })}</span>
                    )}
                  </th>
                  <td className="px-1 py-1.5">
                    <Input
                      value={row.spec ?? ""}
                      maxLength={120}
                      aria-label={`${t(`items.${item}`)} — ${t("columns.spec")}`}
                      onChange={(event) => patch(item, { spec: event.target.value })}
                      className={cell}
                    />
                  </td>
                  <td className="w-24 px-1 py-1.5">
                    <Input
                      inputMode="numeric"
                      value={row.quantity == null ? "" : String(row.quantity)}
                      placeholder={suggested !== null ? String(suggested) : undefined}
                      aria-label={`${t(`items.${item}`)} — ${t("columns.quantity")}`}
                      onChange={(event) => patch(item, { quantity: number(event.target.value, 4) })}
                      className={cell}
                    />
                  </td>
                  <td className="w-28 px-1 py-1.5">
                    <Input
                      inputMode="numeric"
                      value={row.cost == null ? "" : String(row.cost)}
                      aria-label={`${t(`items.${item}`)} — ${t("columns.cost")}`}
                      onChange={(event) => patch(item, { cost: number(event.target.value, 6) })}
                      className={cell}
                    />
                  </td>
                  <td className="w-40 px-1 py-1.5">
                    <Input
                      type="date"
                      value={row.receivedOn ?? ""}
                      aria-label={`${t(`items.${item}`)} — ${t("columns.receivedOn")}`}
                      onChange={(event) => patch(item, { receivedOn: event.target.value })}
                      className={cell}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {total > 0 && (
        <p className="font-serif text-xl">
          {t("total", { amount: format.number(total, { style: "currency", currency, maximumFractionDigits: 0 }) })}
        </p>
      )}
    </PlanCard>
  );
}

/** Site du mariage : ce qu'il doit réunir, et ce que Céleste assure déjà. */
export function WebsiteTools({
  initial,
  covered,
}: {
  initial: PlanOf<"website">;
  /** Éléments déjà offerts par le lien personnel des invités. */
  covered: WebsiteElement[];
}) {
  const t = useTranslations("Vendors.tools.website");
  const { plan, setPlan, dirty, pending, save } = usePlan("website", initial);
  return (
    <PlanCard title={t("title")} lead={t("lead")} dirty={dirty} pending={pending} onSave={save}>
      <ul className="flex flex-col gap-1.5">
        {WEBSITE_ELEMENTS.map((element) => {
          const byCeleste = covered.includes(element);
          const done = byCeleste || plan.done.includes(element);
          return (
            <li key={element}>
              <label
                className={cn(
                  "flex items-start gap-3 rounded-xl px-2 py-1.5 text-sm leading-5",
                  !byCeleste && "cursor-pointer hover:bg-linen/60",
                )}
              >
                {byCeleste ? (
                  <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-sage-deep" />
                ) : (
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => setPlan({ ...plan, done: toggle(plan.done, element) })}
                    className="mt-0.5 size-4 shrink-0 accent-sage-deep"
                  />
                )}
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className={done ? "text-stone" : ""}>{t(`elements.${element}`)}</span>
                  {byCeleste && (
                    <span className="rounded-full bg-sage-soft px-2 py-0.5 text-xs text-sage-deep">{t("celeste")}</span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </PlanCard>
  );
}

/** Cadeaux des invités : les idées qui tentent les mariés. */
export function GiftTools({ initial, guestCount }: { initial: PlanOf<"guest_gifts">; guestCount: number | null }) {
  const t = useTranslations("Vendors.tools.gifts");
  const { plan, setPlan, dirty, pending, save } = usePlan("guest_gifts", initial);
  return (
    <PlanCard
      title={t("title")}
      lead={guestCount ? t("lead", { count: guestCount }) : t("leadNoGuests")}
      dirty={dirty}
      pending={pending}
      onSave={save}
    >
      <div className="flex flex-wrap gap-2">
        {GIFT_IDEAS.map((idea) => (
          <ToggleChip
            key={idea}
            pressed={plan.ideas.includes(idea)}
            onClick={() => setPlan({ ...plan, ideas: toggle(plan.ideas, idea) })}
          >
            {t(`ideas.${idea}`)}
          </ToggleChip>
        ))}
      </div>
    </PlanCard>
  );
}

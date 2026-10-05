import { getFormatter, getTranslations } from "next-intl/server";
import type { BudgetItem, BudgetSummary } from "@/lib/budget/schema";
import { cn } from "@/lib/utils";

type BudgetGaugeProps = {
  /** null tant que le budget total n'est pas défini. */
  summary: BudgetSummary | null;
  items: BudgetItem[];
  currency: string;
};

/** Jauge horizontale : dépensé (Terracotta) et réparti (Sauge) sur fond Lin. */
export async function BudgetGauge({ summary, items, currency }: BudgetGaugeProps) {
  const t = await getTranslations("Dashboard.budget");
  const format = await getFormatter();
  const money = (amount: number) =>
    format.number(amount, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });

  return (
    <section
      aria-labelledby="budget-title"
      className="flex flex-col gap-6 rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="budget-title" className="text-2xl">
          {t("title")}
        </h2>
        {summary && (
          <p className="text-sm text-stone tabular-nums">
            {t("percentSpent", {
              percent: format.number(summary.spentRatio, {
                style: "percent",
                maximumFractionDigits: 0,
              }),
            })}
          </p>
        )}
      </div>

      {summary ? (
        <>
          <p className="flex flex-wrap items-baseline gap-x-2 font-serif text-4xl tabular-nums">
            {money(summary.spent)}
            <span className="font-sans text-base text-stone">
              {t("of", { total: money(summary.total) })}
            </span>
          </p>

          <div
            role="meter"
            aria-label={t("meterLabel")}
            aria-valuemin={0}
            aria-valuemax={summary.total}
            aria-valuenow={Math.min(summary.spent, summary.total)}
            aria-valuetext={t("of", { total: money(summary.total) })}
            className="relative h-3 overflow-hidden rounded-full bg-linen"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-sage-soft transition-[width] duration-700 ease-out"
              style={{ width: `${summary.allocatedRatio * 100}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-terracotta transition-[width] duration-700 ease-out"
              style={{ width: `${summary.spentRatio * 100}%` }}
            />
          </div>

          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div className="flex flex-col gap-1">
              <dt className="flex items-center gap-2 text-stone">
                <span aria-hidden className="size-2 rounded-full bg-terracotta" />
                {t("spent")}
              </dt>
              <dd className="tabular-nums">{money(summary.spent)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="flex items-center gap-2 text-stone">
                <span aria-hidden className="size-2 rounded-full bg-sage" />
                {t("allocated")}
              </dt>
              <dd className="tabular-nums">{money(summary.allocated)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="flex items-center gap-2 text-stone">
                <span aria-hidden className="size-2 rounded-full bg-linen ring-1 ring-sand" />
                {t("remaining")}
              </dt>
              <dd
                className={cn(
                  "tabular-nums",
                  summary.overBudget && "text-terracotta",
                )}
              >
                {summary.overBudget
                  ? t("overBudget", {
                      amount: money(summary.spent - summary.total),
                    })
                  : money(summary.total - summary.spent)}
              </dd>
            </div>
          </dl>

          {items.length > 0 && (
            <ul className="flex flex-col divide-y divide-border border-t border-border">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-baseline justify-between gap-4 py-3 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {t(`categories.${item.category}`)}
                    {item.label && (
                      <span className="text-stone"> · {item.label}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-stone tabular-nums">
                    {item.actual_amount === null
                      ? t("estimated", { amount: money(item.estimated_amount) })
                      : t("actualOfEstimated", {
                          actual: money(item.actual_amount),
                          estimated: money(item.estimated_amount),
                        })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-stone">{t("noBudget")}</p>
      )}
    </section>
  );
}

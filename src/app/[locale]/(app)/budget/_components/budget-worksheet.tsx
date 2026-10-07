"use client";

import { ChevronDownIcon, PlusIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  monthlySaving,
  summarizeByPayer,
  summarizeEnvelope,
  type BudgetItem,
} from "@/lib/budget/schema";
import {
  BUDGET_SECTIONS,
  SECTION_TRADITION,
  type BudgetPayer,
  type BudgetSection,
} from "@/lib/budget/worksheet";
import { cn } from "@/lib/utils";
import { BudgetLineRow } from "./budget-line-row";

/** Couleur de chaque payeur dans la répartition. */
const PAYER_COLORS: Record<BudgetPayer, string> = {
  couple: "bg-sage",
  brideFamily: "bg-terracotta",
  groomFamily: "bg-lavender",
  shared: "bg-caramel",
  witnesses: "bg-stone/60",
};

type Draft = { key: string; section: BudgetSection };

/**
 * Le budget en grille : indicateurs, alerte de dépassement, répartition par
 * payeur, puis les rubriques et leurs postes à compléter.
 */
export function BudgetWorksheet({
  initialItems,
  total,
  currency,
  monthsLeft,
}: {
  initialItems: BudgetItem[];
  /** Enveloppe totale ; null tant qu'elle n'est pas définie. */
  total: number | null;
  currency: string;
  /** Mois restants avant le mariage ; null sans date (ou date passée). */
  monthsLeft: number | null;
}) {
  const t = useTranslations("Budget");
  const format = useFormatter();
  const [items, setItems] = useState(initialItems);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  // Rubriques ouvertes : celles qui contiennent déjà une ligne, sinon la première.
  // Rubriques repliées par défaut : le couple ouvre celles qu'il veut travailler.
  const [open, setOpen] = useState<ReadonlySet<BudgetSection>>(() => new Set());

  const money = (amount: number) =>
    format.number(amount, { style: "currency", currency, maximumFractionDigits: 0 });

  const envelope = summarizeEnvelope(total, items);
  const overProjected = envelope.remaining !== null && envelope.remaining < 0;
  const missing = overProjected ? -(envelope.remaining ?? 0) : 0;
  const perMonth = monthlySaving(missing, monthsLeft);
  const byPayer = summarizeByPayer(items);
  const payerTotal = byPayer.reduce((sum, entry) => sum + entry.amount, 0);

  /** Remplace (ou retire) la ligne enregistrée correspondant à une clé de ligne. */
  function replace(previousId: string | null, lineKey: string | null, next: BudgetItem | null) {
    setItems((current) => {
      const rest = current.filter(
        (item) => item.id !== previousId && (lineKey === null || item.line_key !== lineKey),
      );
      return next ? [...rest, next] : rest;
    });
  }

  function toggle(section: BudgetSection) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  function addDraft(section: BudgetSection) {
    setDrafts((current) => [...current, { key: crypto.randomUUID(), section }]);
    setOpen((current) => new Set(current).add(section));
  }

  const kpis = [
    {
      key: "envelope",
      value: envelope.total === null ? t("kpis.noEnvelope") : money(envelope.total),
      hint: null,
      tone: "neutral",
    },
    {
      key: "committed",
      value: money(envelope.committed),
      hint:
        envelope.total !== null && envelope.total > 0
          ? t("kpis.committedShare", {
              percent: format.number(envelope.committed / envelope.total, {
                style: "percent",
                maximumFractionDigits: 0,
              }),
            })
          : null,
      tone: envelope.total !== null && envelope.committed > envelope.total ? "alert" : "good",
    },
    {
      key: "remaining",
      value:
        envelope.remaining === null
          ? "—"
          : money(overProjected ? -envelope.remaining : envelope.remaining),
      hint: overProjected ? t("kpis.overBy") : t("kpis.remainingHint"),
      tone: overProjected ? "alert" : "good",
    },
  ] as const;

  return (
    <div className="flex flex-col gap-10">
      <dl className="grid gap-3 sm:grid-cols-3">
        {kpis.map(({ key, value, hint, tone }) => (
          <div
            key={key}
            className={cn(
              "flex flex-col-reverse gap-1 rounded-3xl px-5 py-5",
              tone === "neutral"
                ? "bg-linen"
                : tone === "alert"
                  ? "bg-terracotta-soft/70"
                  : "bg-sage-soft",
            )}
          >
            <dt className="flex flex-col text-sm text-stone">
              {t(`kpis.${key}`)}
              {hint && <span className="text-xs">{hint}</span>}
            </dt>
            <dd
              className={cn(
                "font-serif text-3xl tabular-nums wrap-break-word",
                tone === "neutral"
                  ? "text-charcoal"
                  : tone === "alert"
                    ? "text-terracotta"
                    : "text-sage-deep",
              )}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {overProjected && (
        <section
          role="status"
          aria-labelledby="over-budget-title"
          className="flex flex-col gap-2 rounded-3xl border border-terracotta/25 bg-terracotta-soft/60 px-6 py-5"
        >
          <h2 id="over-budget-title" className="font-serif text-2xl text-terracotta">
            {t("overBudget.title")}
          </h2>
          <p className="text-lg text-charcoal tabular-nums">
            {t("overBudget.missing", { amount: money(missing) })}
          </p>
          <p className="text-stone tabular-nums">
            {perMonth === null
              ? t("overBudget.tipNoDate")
              : t("overBudget.tip", { perMonth: money(perMonth) })}
          </p>
          {monthsLeft !== null && (
            <p className="text-sm text-stone">{t("overBudget.months", { count: monthsLeft })}</p>
          )}
        </section>
      )}

      {byPayer.length > 0 && (
        <section
          aria-labelledby="payers-title"
          className="flex flex-col gap-4 rounded-3xl bg-linen p-5 sm:p-6"
        >
          <h2 id="payers-title" className="font-serif text-2xl">
            {t("payersSummary.title")}
          </h2>
          <div aria-hidden className="flex h-2.5 overflow-hidden rounded-full bg-sand/50">
            {byPayer.map(({ payer, amount }) => (
              <span
                key={payer}
                className={cn("h-full", PAYER_COLORS[payer])}
                style={{ width: `${(amount / payerTotal) * 100}%` }}
              />
            ))}
          </div>
          <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {byPayer.map(({ payer, amount }) => (
              <li key={payer} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-charcoal">
                  <span aria-hidden className={cn("size-2.5 rounded-full", PAYER_COLORS[payer])} />
                  {t(`payers.${payer}`)}
                </span>
                <span className="text-stone tabular-nums">
                  {money(amount)} ·{" "}
                  {format.number(amount / payerTotal, {
                    style: "percent",
                    maximumFractionDigits: 0,
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="worksheet-title" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="worksheet-title" className="font-serif text-3xl">
            {t("worksheet.title")}
          </h2>
          <p className="text-stone">{t("worksheet.intro")}</p>
        </div>

        <ul className="flex flex-col gap-3">
          {BUDGET_SECTIONS.map((section) => {
            const sectionItems = items.filter((item) => item.section === section.key);
            const custom = sectionItems.filter((item) => item.line_key === null);
            const sectionDrafts = drafts.filter((draft) => draft.section === section.key);
            const estimated = sectionItems.reduce((sum, item) => sum + item.estimated_amount, 0);
            const actual = sectionItems.reduce((sum, item) => sum + (item.actual_amount ?? 0), 0);
            // Montant de la rubrique : signé, sinon prévu (comme les indicateurs du haut).
            const projected = sectionItems.reduce(
              (sum, item) => sum + (item.actual_amount ?? item.estimated_amount),
              0,
            );
            const share = total !== null && total > 0 && projected > 0 ? projected / total : null;
            const filled = sectionItems.filter(
              (item) => item.estimated_amount > 0 || item.actual_amount !== null || item.notes,
            ).length;
            const isOpen = open.has(section.key);
            const panelId = `section-${section.key}`;

            return (
              <li key={section.key} className="overflow-hidden rounded-3xl bg-linen">
                <h3>
                  <button
                    type="button"
                    onClick={() => toggle(section.key)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 text-left transition-colors hover:bg-sand/30 sm:px-6"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-serif text-xl">
                        {t(`worksheet.sections.${section.key}`)}
                      </span>
                      <span className="font-sans text-xs text-stone tabular-nums">
                        {t("worksheet.filled", {
                          filled,
                          total: section.lines.length + custom.length,
                        })}
                        {(estimated > 0 || actual > 0) &&
                          ` · ${t("worksheet.subtotal", {
                            estimated: money(estimated),
                            actual: money(actual),
                          })}`}
                      </span>
                    </span>
                    {projected > 0 && (
                      <span className="flex flex-col items-end gap-0.5 text-right">
                        <span className="font-serif text-xl text-charcoal tabular-nums">
                          {money(projected)}
                        </span>
                        {share !== null && (
                          <span className="font-sans text-xs text-sage-deep tabular-nums">
                            {t("worksheet.share", {
                              percent: format.number(share, {
                                style: "percent",
                                maximumFractionDigits: share < 0.1 ? 1 : 0,
                              }),
                            })}
                          </span>
                        )}
                      </span>
                    )}
                    <ChevronDownIcon
                      aria-hidden
                      className={cn(
                        "size-4 text-stone transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                </h3>

                {isOpen && (
                  <div id={panelId} className="border-t border-sand/70 px-5 pt-2 pb-4 sm:px-6">
                    <div
                      aria-hidden
                      className="hidden grid-cols-[minmax(0,1.5fr)_7rem_7rem_10.5rem_minmax(0,1.3fr)_2rem] gap-x-3 py-2 text-xs text-stone sm:grid"
                    >
                      <span>{t("worksheet.columns.line")}</span>
                      <span className="pr-2.5 text-right">{t("worksheet.columns.estimated")}</span>
                      <span className="pr-2.5 text-right">{t("worksheet.columns.actual")}</span>
                      <span className="pl-2.5">{t("worksheet.columns.payer")}</span>
                      <span className="pl-2.5">{t("worksheet.columns.notes")}</span>
                      <span />
                    </div>
                    <ul className="flex flex-col divide-y divide-sand/70">
                      {section.lines.map((definition) => {
                        const item =
                          sectionItems.find((entry) => entry.line_key === definition.key) ?? null;
                        return (
                          <BudgetLineRow
                            key={definition.key}
                            item={item}
                            section={section.key}
                            lineKey={definition.key}
                            name={t(`worksheet.lines.${definition.key}`)}
                            tradition={definition.tradition}
                            currency={currency}
                            onSaved={(next) => replace(item?.id ?? null, definition.key, next)}
                          />
                        );
                      })}
                      {custom.map((item) => (
                        <BudgetLineRow
                          key={item.id}
                          item={item}
                          section={section.key}
                          lineKey={null}
                          name={null}
                          tradition={SECTION_TRADITION[section.key]}
                          currency={currency}
                          onSaved={(next) => replace(item.id, null, next)}
                        />
                      ))}
                      {sectionDrafts.map((draft) => (
                        <BudgetLineRow
                          key={draft.key}
                          item={null}
                          section={section.key}
                          lineKey={null}
                          name={null}
                          tradition={SECTION_TRADITION[section.key]}
                          currency={currency}
                          autoFocus
                          onSaved={(next) => {
                            // Premier enregistrement : la ligne passe des brouillons aux lignes.
                            setDrafts((current) =>
                              current.filter((entry) => entry.key !== draft.key),
                            );
                            if (next) replace(null, null, next);
                          }}
                          onRemoved={() =>
                            setDrafts((current) =>
                              current.filter((entry) => entry.key !== draft.key),
                            )
                          }
                        />
                      ))}
                    </ul>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addDraft(section.key)}
                      className="mt-2 rounded-full text-sage-deep"
                    >
                      <PlusIcon aria-hidden />
                      {t("worksheet.addLine")}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  groupBudgetItems,
  parseBudgetItem,
  summarizeEnvelope,
  type BudgetActionError,
  type BudgetItem,
  type BudgetItemData,
  type BudgetItemInput,
} from "@/lib/budget/schema";
import { suggestMissingVendors, type BudgetSuggestion } from "@/lib/budget/suggestions";
import type { InspirationLikes } from "@/lib/inspiration/catalog";
import { cn } from "@/lib/utils";
import { addBudgetItem, deleteBudgetItem, updateBudgetItem } from "../actions";
import { BudgetSuggestions } from "./budget-suggestions";
import { BudgetItemDialog } from "./budget-item-dialog";
import { DeleteBudgetItemButton } from "./delete-budget-item-button";

const OPTIMISTIC_PREFIX = "optimistic-";

type OptimisticAction =
  | { type: "add"; item: BudgetItem }
  | { type: "update"; id: string; data: BudgetItemData }
  | { type: "delete"; id: string };

// Les lignes ajoutées passent en dernier, comme dans la requête (created_at croissant).
function applyAction(state: BudgetItem[], action: OptimisticAction): BudgetItem[] {
  switch (action.type) {
    case "add":
      return [...state, action.item];
    case "update":
      return state.map((item) =>
        item.id === action.id ? { ...item, ...toRow(action.data) } : item,
      );
    case "delete":
      return state.filter((item) => item.id !== action.id);
  }
}

function toRow(data: BudgetItemData): Omit<BudgetItem, "id"> {
  return {
    category: data.category,
    label: data.label,
    estimated_amount: data.estimatedAmount,
    actual_amount: data.actualAmount,
  };
}

type BudgetBoardProps = {
  items: BudgetItem[];
  /** Enveloppe totale du mariage ; null tant qu'elle n'est pas définie. */
  total: number | null;
  currency: string;
  weddingId: string;
  /** Carnet d'inspiration, pour les suggestions de prestataires. */
  likes: InspirationLikes;
};

/** Indicateurs de l'enveloppe et prestataires par catégorie, mis à jour instantanément. */
export function BudgetBoard({ items, total, currency, weddingId, likes }: BudgetBoardProps) {
  const t = useTranslations("Budget");
  const format = useFormatter();
  const [, startTransition] = useTransition();
  const [optimisticItems, apply] = useOptimistic(items, applyAction);

  const money = (amount: number) =>
    format.number(amount, { style: "currency", currency, maximumFractionDigits: 0 });

  const envelope = summarizeEnvelope(total, optimisticItems);
  const groups = groupBudgetItems(optimisticItems);
  const itemName = (item: BudgetItem) => item.label ?? t(`categories.${item.category}`);

  const notifyError = (error: BudgetActionError) => toast.error(t(`errors.${error}`));

  // Recalculées sur les lignes optimistes : une suggestion ajoutée disparaît aussitôt.
  const suggestions = suggestMissingVendors({ items: optimisticItems, likes, totalBudget: total });

  function addSuggestion(suggestion: BudgetSuggestion, label: string) {
    add({
      category: suggestion.category,
      label,
      estimatedAmount: String(suggestion.estimate ?? 0),
      actualAmount: "",
    });
    toast(t("suggestions.added", { name: label }));
  }

  function add(input: BudgetItemInput) {
    const parsed = parseBudgetItem(input);
    if (!parsed.ok) return;
    startTransition(async () => {
      apply({
        type: "add",
        item: { id: `${OPTIMISTIC_PREFIX}${crypto.randomUUID()}`, ...toRow(parsed.data) },
      });
      const result = await addBudgetItem(input);
      if (!result.ok) notifyError(result.error);
    });
  }

  function update(item: BudgetItem, input: BudgetItemInput) {
    const parsed = parseBudgetItem(input);
    if (!parsed.ok) return;
    startTransition(async () => {
      apply({ type: "update", id: item.id, data: parsed.data });
      const result = await updateBudgetItem(item.id, input);
      if (!result.ok) notifyError(result.error);
    });
  }

  function remove(item: BudgetItem) {
    startTransition(async () => {
      apply({ type: "delete", id: item.id });
      const result = await deleteBudgetItem(item.id);
      if (!result.ok) {
        notifyError(result.error);
        return;
      }
      toast(t("delete.success", { name: itemName(item) }));
    });
  }

  const overCommitted = envelope.total !== null && envelope.committed > envelope.total;
  const overProjected = envelope.remaining !== null && envelope.remaining < 0;

  const kpis = [
    {
      key: "envelope",
      value: envelope.total === null ? t("kpis.noEnvelope") : money(envelope.total),
      hint: null,
      surface: "bg-linen",
      figure: "text-charcoal",
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
      surface: overCommitted ? "bg-terracotta-soft/70" : "bg-sage-soft",
      figure: overCommitted ? "text-terracotta" : "text-sage-deep",
    },
    {
      key: "remaining",
      value:
        envelope.remaining === null
          ? "—"
          : overProjected
            ? money(-envelope.remaining)
            : money(envelope.remaining),
      hint: overProjected ? t("kpis.overBy") : t("kpis.remainingHint"),
      surface: overProjected ? "bg-terracotta-soft/70" : "bg-sage-soft",
      figure: overProjected ? "text-terracotta" : "text-sage-deep",
    },
  ] as const;

  return (
    <div className="flex flex-col gap-10">
      <dl className="grid gap-3 sm:grid-cols-3">
        {kpis.map(({ key, value, hint, surface, figure }) => (
          <div
            key={key}
            className={cn("flex flex-col-reverse gap-1 rounded-3xl px-5 py-5", surface)}
          >
            <dt className="flex flex-col text-sm text-stone">
              {t(`kpis.${key}`)}
              {hint && <span className="text-xs">{hint}</span>}
            </dt>
            <dd className={cn("font-serif text-3xl tabular-nums wrap-break-word", figure)}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="vendors-title" className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 id="vendors-title" className="font-serif text-3xl">
              {t("vendors.title")}
            </h2>
            <p className="text-stone">{t("vendors.intro")}</p>
          </div>
          <BudgetItemDialog
            currency={currency}
            onSubmit={add}
            trigger={
              <Button size="lg" className="h-11 w-fit rounded-full px-5">
                <PlusIcon aria-hidden />
                {t("add.trigger")}
              </Button>
            }
          />
        </div>

        <BudgetSuggestions
          suggestions={suggestions}
          currency={currency}
          storageKey={`celeste.budget.dismissedSuggestions.${weddingId}`}
          onAdd={addSuggestion}
        />

        {groups.length === 0 ? (
          <p className="rounded-3xl bg-linen px-6 py-10 text-center text-stone">
            {t("vendors.empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {groups.map((group) => {
              const overGroup = group.projected > group.estimated;
              const ratio =
                group.estimated > 0 ? Math.min(group.actual / group.estimated, 1) : 0;
              return (
                <li key={group.category}>
                  <section
                    aria-labelledby={`category-${group.category}`}
                    className="flex flex-col gap-4 rounded-3xl bg-linen p-5 sm:p-6"
                  >
                    <header className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h3
                          id={`category-${group.category}`}
                          className="font-serif text-2xl"
                        >
                          {t(`categories.${group.category}`)}
                        </h3>
                        <p className="text-sm text-stone tabular-nums">
                          {t("vendors.groupTotal", {
                            actual: money(group.actual),
                            estimated: money(group.estimated),
                          })}
                        </p>
                      </div>
                      <div aria-hidden className="h-1 overflow-hidden rounded-full bg-sand/60">
                        <div
                          className={cn(
                            "h-full rounded-full transition-[width] duration-700 ease-out",
                            overGroup ? "bg-terracotta" : "bg-sage",
                          )}
                          style={{ width: `${(overGroup ? 1 : ratio) * 100}%` }}
                        />
                      </div>
                    </header>

                    <ul className="flex flex-col divide-y divide-sand">
                      {group.items.map((item) => {
                        const pending = item.id.startsWith(OPTIMISTIC_PREFIX);
                        const over =
                          item.actual_amount !== null &&
                          item.actual_amount > item.estimated_amount;
                        return (
                          <li
                            key={item.id}
                            className={cn(
                              "flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4",
                              pending && "opacity-60",
                            )}
                          >
                            <span
                              className={cn(
                                "min-w-0 flex-1 text-base wrap-break-word",
                                !item.label && "text-stone italic",
                              )}
                            >
                              {item.label ?? t("vendors.unnamed")}
                            </span>
                            <span className="flex items-center justify-between gap-4 sm:justify-end">
                              <span className="flex items-baseline gap-4 text-sm tabular-nums">
                                <span className="flex flex-col sm:items-end">
                                  <span className="text-xs text-stone">
                                    {t("vendors.estimated")}
                                  </span>
                                  <span className="text-stone">
                                    {money(item.estimated_amount)}
                                  </span>
                                </span>
                                <span className="flex min-w-24 flex-col sm:items-end">
                                  <span className="text-xs text-stone">
                                    {t("vendors.actual")}
                                  </span>
                                  {item.actual_amount === null ? (
                                    <span className="text-stone">{t("vendors.notSigned")}</span>
                                  ) : (
                                    <span
                                      className={cn(
                                        "font-medium",
                                        over ? "text-terracotta" : "text-sage-deep",
                                      )}
                                    >
                                      {money(item.actual_amount)}
                                    </span>
                                  )}
                                </span>
                              </span>
                              <span className="flex items-center">
                                <BudgetItemDialog
                                  item={item}
                                  currency={currency}
                                  onSubmit={(input) => update(item, input)}
                                  trigger={
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      disabled={pending}
                                      aria-label={t("edit.trigger", { name: itemName(item) })}
                                      className="text-stone"
                                    >
                                      <PencilIcon aria-hidden />
                                    </Button>
                                  }
                                />
                                {!pending && (
                                  <DeleteBudgetItemButton
                                    itemName={itemName(item)}
                                    onConfirm={() => remove(item)}
                                  />
                                )}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

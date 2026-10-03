/** Slugs de catégories, alignés sur la contrainte CHECK de budget_items (000003). */
export const BUDGET_CATEGORIES = [
  "venue",
  "catering",
  "photography",
  "attire",
  "decoration",
  "music",
  "stationery",
  "contingency",
  "other",
] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

/** Ligne de la table budget_items ; montants en unités entières de la devise. */
export type BudgetItem = {
  id: string;
  category: BudgetCategory;
  label: string | null;
  estimated_amount: number;
  actual_amount: number | null;
};

export type BudgetSummary = {
  total: number;
  /** Somme des montants réels (dépensés ou engagés). */
  spent: number;
  /** Somme des montants prévus sur les lignes de budget. */
  allocated: number;
  /** Ratios bornés à [0, 1] pour l'affichage de la jauge. */
  spentRatio: number;
  allocatedRatio: number;
  overBudget: boolean;
};

const clampRatio = (value: number, total: number) =>
  total > 0 ? Math.min(Math.max(value / total, 0), 1) : 0;

/** Calcul budgétaire pur (jamais délégué à l'IA). */
export function summarizeBudget(
  total: number,
  items: readonly Pick<BudgetItem, "estimated_amount" | "actual_amount">[],
): BudgetSummary {
  const spent = items.reduce((sum, item) => sum + (item.actual_amount ?? 0), 0);
  const allocated = items.reduce((sum, item) => sum + item.estimated_amount, 0);
  return {
    total,
    spent,
    allocated,
    spentRatio: clampRatio(spent, total),
    allocatedRatio: clampRatio(allocated, total),
    overBudget: spent > total,
  };
}

import { z } from "zod";

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

/** Plafond des montants saisis : reste loin de la limite d'un integer PostgreSQL. */
export const BUDGET_LIMITS = {
  label: 200,
  amount: 100_000_000,
} as const;

// « 1 500 », « 1 500 » (espace insécable) ou « 1500 » : seuls les entiers sont acceptés,
// les montants étant stockés en unités entières de la devise.
const AMOUNT_PATTERN = /^\d+$/;
const stripSpaces = (value: string) => value.replace(/[\s  ]/g, "");

const amount = z
  .string()
  .transform(stripSpaces)
  .pipe(z.string().min(1).regex(AMOUNT_PATTERN))
  .transform(Number)
  .pipe(z.number().int().max(BUDGET_LIMITS.amount));

const optionalAmount = z
  .string()
  .transform(stripSpaces)
  .pipe(z.union([z.literal(""), z.string().regex(AMOUNT_PATTERN)]))
  .transform((value) => (value === "" ? null : Number(value)))
  .pipe(z.number().int().max(BUDGET_LIMITS.amount).nullable());

export const budgetItemSchema = z.object({
  category: z.enum(BUDGET_CATEGORIES),
  // Nom du prestataire ; facultatif tant qu'il n'est pas choisi (la contrainte SQL refuse "").
  label: z
    .string()
    .trim()
    .max(BUDGET_LIMITS.label)
    .transform((value) => (value === "" ? null : value)),
  estimatedAmount: amount,
  actualAmount: optionalAmount,
});
export type BudgetItemInput = z.input<typeof budgetItemSchema>;
export type BudgetItemData = z.output<typeof budgetItemSchema>;
export type BudgetItemField = keyof BudgetItemInput;
export type BudgetItemFieldError = "required" | "tooLong" | "amount";
export type BudgetItemFieldErrors = Partial<Record<BudgetItemField, BudgetItemFieldError>>;

/** Traduit les erreurs Zod en clés d'erreur par champ (partagé client/serveur). */
export function parseBudgetItem(
  input: BudgetItemInput,
): { ok: true; data: BudgetItemData } | { ok: false; fieldErrors: BudgetItemFieldErrors } {
  const parsed = budgetItemSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: BudgetItemFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as BudgetItemField;
    fieldErrors[field] ??=
      field === "label"
        ? "tooLong"
        : field === "category" || (field === "estimatedAmount" && input.estimatedAmount.trim() === "")
          ? "required"
          : "amount";
  }
  return { ok: false, fieldErrors };
}

export const budgetItemIdSchema = z.uuid();

export type BudgetActionError = "unauthenticated" | "forbidden" | "invalid" | "generic";
export type BudgetActionResult = { ok: true } | { ok: false; error: BudgetActionError };

export type EnvelopeSummary = {
  /** null tant que l'enveloppe n'est pas définie. */
  total: number | null;
  /** Somme des montants signés. */
  committed: number;
  /** Projection : le montant signé remplace l'estimation dès qu'il existe. */
  projected: number;
  /** Enveloppe moins la projection ; négatif en cas de dépassement. */
  remaining: number | null;
};

/** Calcul budgétaire pur (jamais délégué à l'IA). */
export function summarizeEnvelope(
  total: number | null,
  items: readonly Pick<BudgetItem, "estimated_amount" | "actual_amount">[],
): EnvelopeSummary {
  let committed = 0;
  let projected = 0;
  for (const item of items) {
    committed += item.actual_amount ?? 0;
    projected += item.actual_amount ?? item.estimated_amount;
  }
  return {
    total,
    committed,
    projected,
    remaining: total === null ? null : total - projected,
  };
}

export type BudgetCategoryGroup = {
  category: BudgetCategory;
  items: BudgetItem[];
  estimated: number;
  /** Somme des montants signés de la catégorie. */
  actual: number;
  /** Projection de la catégorie (signé, sinon prévu). */
  projected: number;
};

/** Regroupe les lignes par catégorie, dans l'ordre de BUDGET_CATEGORIES ; catégories vides omises. */
export function groupBudgetItems(items: readonly BudgetItem[]): BudgetCategoryGroup[] {
  return BUDGET_CATEGORIES.flatMap((category) => {
    const categoryItems = items.filter((item) => item.category === category);
    if (categoryItems.length === 0) return [];
    const { committed, projected } = summarizeEnvelope(null, categoryItems);
    return [
      {
        category,
        items: categoryItems,
        estimated: categoryItems.reduce((sum, item) => sum + item.estimated_amount, 0),
        actual: committed,
        projected,
      },
    ];
  });
}

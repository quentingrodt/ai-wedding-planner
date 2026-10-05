import { z } from "zod";
import {
  BUDGET_LINE_KEYS,
  BUDGET_PAYERS,
  BUDGET_SECTION_KEYS,
  lineDefinition,
  SECTION_TRADITION,
  type BudgetLineKey,
  type BudgetPayer,
  type BudgetSection,
} from "./worksheet";

/** Slugs de catégories, alignés sur la contrainte CHECK de budget_items (000016). */
export const BUDGET_CATEGORIES = [
  "venue",
  "catering",
  "cake",
  "photography",
  "music",
  "decoration",
  "attire",
  "beauty",
  "rings",
  "stationery",
  "officiant",
  "transport",
  "honeymoon",
  "contingency",
  "other",
] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

/** Comment le couple compte trouver le prestataire (budget_items.sourcing). */
export const BUDGET_SOURCINGS = ["network", "celeste", "undecided"] as const;
export type BudgetSourcing = (typeof BUDGET_SOURCINGS)[number];

/**
 * Répartition indicative du budget total, en part du total : lignes créées à
 * l'onboarding, et aperçu montré à la fin de Date Night.
 */
export const DEFAULT_BUDGET_SPLIT = [
  { category: "venue", share: 0.4, section: "ceremonyReception", lineKey: "venueRental" },
  { category: "catering", share: 0.3, section: "food", lineKey: "dinnerCatering" },
  { category: "contingency", share: 0.1, section: "other", lineKey: "contingency" },
] as const satisfies readonly {
  category: BudgetCategory;
  share: number;
  section: BudgetSection;
  lineKey: BudgetLineKey;
}[];

/** Ligne de la table budget_items ; montants en unités entières de la devise. */
export type BudgetItem = {
  id: string;
  category: BudgetCategory;
  label: string | null;
  /** Montant prévu saisi par le couple : seul compté dans la jauge. */
  estimated_amount: number;
  actual_amount: number | null;
  /** Indication de marché de Céleste, affichée à titre indicatif, jamais comptée. */
  suggested_amount: number | null;
  sourcing: BudgetSourcing;
  /** Rubrique de la grille (worksheet.ts). */
  section: BudgetSection;
  /** Poste de la grille ; null pour un poste ajouté par le couple (label requis). */
  line_key: BudgetLineKey | null;
  notes: string | null;
  /** Null : le payeur traditionnel du poste s'applique. */
  payer: BudgetPayer | null;
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

const optionalAmount = z
  .string()
  .transform(stripSpaces)
  .pipe(z.union([z.literal(""), z.string().regex(AMOUNT_PATTERN)]))
  .transform((value) => (value === "" ? null : Number(value)))
  .pipe(z.number().int().max(BUDGET_LIMITS.amount).nullable());

export const NOTES_MAX = 500;

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

/**
 * Saisie d'un poste de la grille (partagé client/serveur). Un poste de la
 * grille est identifié par lineKey ; un poste ajouté par le couple, par son
 * libellé dans sa rubrique.
 */
export const budgetLineSchema = z
  .object({
    id: z.uuid().nullable(),
    lineKey: z.enum(BUDGET_LINE_KEYS as [BudgetLineKey, ...BudgetLineKey[]]).nullable(),
    section: z.enum(BUDGET_SECTION_KEYS as [BudgetSection, ...BudgetSection[]]),
    label: nullableText(BUDGET_LIMITS.label),
    estimatedAmount: optionalAmount.transform((value) => value ?? 0),
    actualAmount: optionalAmount,
    notes: nullableText(NOTES_MAX),
    payer: z.enum(BUDGET_PAYERS).nullable(),
    sourcing: z.enum(BUDGET_SOURCINGS),
  })
  .refine((line) => line.lineKey !== null || line.label !== null, { path: ["label"] });
export type BudgetLineInput = z.input<typeof budgetLineSchema>;
export type BudgetLineData = z.output<typeof budgetLineSchema>;

/** Un poste de la grille sans aucune saisie n'a pas besoin d'exister en base. */
export const isEmptyLine = (line: BudgetLineData) =>
  line.lineKey !== null &&
  line.estimatedAmount === 0 &&
  line.actualAmount === null &&
  line.notes === null &&
  line.payer === null &&
  line.sourcing === "undecided";

export const budgetItemIdSchema = z.uuid();

export type BudgetActionError = "unauthenticated" | "forbidden" | "invalid" | "generic";
export type BudgetActionResult = { ok: true } | { ok: false; error: BudgetActionError };
export type BudgetLineResult =
  { ok: true; item: BudgetItem | null } | { ok: false; error: BudgetActionError };

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

/** Payeur effectif d'une ligne : choix du couple, sinon la tradition. */
export function effectivePayer(
  item: Pick<BudgetItem, "payer" | "line_key" | "section">,
): BudgetPayer {
  if (item.payer) return item.payer;
  const definition = item.line_key ? lineDefinition(item.line_key) : null;
  return definition?.tradition ?? SECTION_TRADITION[item.section];
}

/** Projection par payeur (signé, sinon prévu), dans l'ordre de BUDGET_PAYERS. */
export function summarizeByPayer(
  items: readonly Pick<
    BudgetItem,
    "payer" | "line_key" | "section" | "estimated_amount" | "actual_amount"
  >[],
): { payer: BudgetPayer; amount: number }[] {
  const totals = new Map<BudgetPayer, number>();
  for (const item of items) {
    const amount = item.actual_amount ?? item.estimated_amount;
    if (amount <= 0) continue;
    const payer = effectivePayer(item);
    totals.set(payer, (totals.get(payer) ?? 0) + amount);
  }
  return BUDGET_PAYERS.flatMap((payer) =>
    totals.has(payer) ? [{ payer, amount: totals.get(payer)! }] : [],
  );
}

/**
 * Mois pleins restants avant le mariage (date ISO « AAAA-MM-JJ »), au moins 1
 * tant que le jour J n'est pas passé ; null sans date ou après le mariage.
 */
export function monthsUntil(weddingDate: string | null, today: Date): number | null {
  if (!weddingDate) return null;
  const [year, month, day] = weddingDate.split("-").map(Number);
  const months =
    (year - today.getFullYear()) * 12 +
    (month - 1 - today.getMonth()) -
    (day < today.getDate() ? 1 : 0);
  const wedding = new Date(year, month - 1, day);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (wedding < startOfToday) return null;
  return Math.max(months, 1);
}

/** Effort d'épargne mensuel pour combler un dépassement (arrondi à l'unité supérieure). */
export function monthlySaving(missing: number, monthsLeft: number | null): number | null {
  if (missing <= 0 || monthsLeft === null) return null;
  return Math.ceil(missing / monthsLeft);
}

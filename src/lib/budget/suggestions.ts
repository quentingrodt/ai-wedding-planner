import type { InspirationLikes } from "@/lib/inspiration/catalog";
import { allocateBudget, type PlanVendor } from "@/lib/plan/allocation";
import type { BudgetCategory, BudgetItem } from "./schema";

/** Suggestions de prestataires, traduites via Budget.suggestions.items.<id>. */
export const BUDGET_SUGGESTIONS = [
  "dj",
  "photographer",
  "attire",
  "florist",
  "stationery",
  "transport",
  "weddingCake",
  "officiant",
  "honeymoon",
  "rings",
] as const;
export type BudgetSuggestionId = (typeof BUDGET_SUGGESTIONS)[number];

type SuggestionRule = {
  /** Catégorie de la ligne ajoutée. */
  category: BudgetCategory;
  /** Poste de la répartition (allocateBudget) qui fournit l'estimation. */
  vendor: PlanVendor;
  /**
   * Comment repérer que le poste est déjà couvert : toute ligne de la
   * catégorie, ou (catégorie « other ») un mot-clé dans le libellé.
   */
  covered: { anyInCategory: true } | { keywords: readonly string[] };
  /** Pertinence selon le carnet ; absente, la suggestion vaut pour tous. */
  relevant?: (likes: InspirationLikes) => boolean;
};

const RULES: Record<BudgetSuggestionId, SuggestionRule> = {
  dj: { category: "music", vendor: "music", covered: { anyInCategory: true } },
  photographer: { category: "photography", vendor: "photographer", covered: { anyInCategory: true } },
  attire: { category: "attire", vendor: "attire", covered: { anyInCategory: true } },
  florist: { category: "decoration", vendor: "florist", covered: { anyInCategory: true } },
  stationery: { category: "stationery", vendor: "stationery", covered: { anyInCategory: true } },
  transport: {
    category: "other",
    vendor: "transport",
    covered: { keywords: ["voiture", "transport", "caleche", "navette", "bus", "chauffeur", "car", "carriage", "shuttle"] },
    relevant: (likes) => (likes.transport?.length ?? 0) > 0,
  },
  weddingCake: {
    category: "other",
    vendor: "weddingCake",
    covered: { keywords: ["piece montee", "gateau", "cake", "dessert", "croquembouche"] },
    relevant: (likes) => (likes.dessert?.length ?? 0) > 0,
  },
  officiant: {
    category: "other",
    vendor: "officiant",
    covered: { keywords: ["officiant", "celebrant", "laique"] },
    relevant: (likes) => likes.ceremony?.includes("secular") ?? false,
  },
  honeymoon: {
    category: "other",
    vendor: "honeymoon",
    covered: { keywords: ["voyage", "lune de miel", "honeymoon", "trip"] },
    relevant: (likes) => (likes.honeymoon?.length ?? 0) > 0,
  },
  rings: {
    category: "other",
    vendor: "rings",
    covered: { keywords: ["alliance", "bague", "ring"] },
  },
};

export type BudgetSuggestion = {
  id: BudgetSuggestionId;
  category: BudgetCategory;
  /** Montant estimé (répartition du budget total), ou null sans budget total. */
  estimate: number | null;
};

/** Minuscules sans accents, pour comparer les libellés aux mots-clés. */
const normalize = (text: string) =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Mot-clé en mot entier, pluriel accepté : « car » ne couvre pas « cartes ». */
const mentions = (label: string, keyword: string) =>
  new RegExp(`\\b${keyword}(s|x)?\\b`).test(label);

/**
 * Postes probablement oubliés : essentiels sans aucune ligne, et choix du
 * carnet sans prestataire correspondant. Estimations calculées en TypeScript
 * (allocateBudget), triées du poste le plus important au plus petit.
 */
export function suggestMissingVendors({
  items,
  likes,
  totalBudget,
}: {
  items: readonly BudgetItem[];
  likes: InspirationLikes;
  totalBudget: number | null;
}): BudgetSuggestion[] {
  const labels = items
    .filter((item) => item.label)
    .map((item) => normalize(item.label ?? ""));
  const categories = new Set(items.map((item) => item.category));
  const allocation = totalBudget && totalBudget > 0 ? allocateBudget(totalBudget, likes) : null;
  const amountOf = new Map(allocation?.lines.map((line) => [line.vendor, line.amount]));

  return BUDGET_SUGGESTIONS.filter((id) => {
    const rule = RULES[id];
    if (rule.relevant && !rule.relevant(likes)) return false;
    return "anyInCategory" in rule.covered
      ? !categories.has(rule.category)
      : !rule.covered.keywords.some((keyword) => labels.some((label) => mentions(label, keyword)));
  })
    .map((id) => ({
      id,
      category: RULES[id].category,
      estimate: amountOf.get(RULES[id].vendor) ?? null,
    }))
    .sort((a, b) => (b.estimate ?? 0) - (a.estimate ?? 0));
}

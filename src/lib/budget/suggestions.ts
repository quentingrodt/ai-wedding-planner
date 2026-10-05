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
   * Le poste est couvert dès qu'une ligne existe dans sa catégorie, ou qu'un
   * libellé le mentionne (lignes saisies avant que la catégorie n'existe).
   */
  keywords?: readonly string[];
  /** Pertinence selon le carnet ; absente, la suggestion vaut pour tous. */
  relevant?: (likes: InspirationLikes) => boolean;
};

const RULES: Record<BudgetSuggestionId, SuggestionRule> = {
  dj: { category: "music", vendor: "music" },
  photographer: { category: "photography", vendor: "photographer" },
  attire: { category: "attire", vendor: "attire" },
  florist: { category: "decoration", vendor: "florist" },
  stationery: { category: "stationery", vendor: "stationery" },
  transport: {
    category: "transport",
    vendor: "transport",
    keywords: [
      "voiture",
      "transport",
      "caleche",
      "navette",
      "bus",
      "chauffeur",
      "car",
      "carriage",
      "shuttle",
    ],
    relevant: (likes) => (likes.transport?.length ?? 0) > 0,
  },
  weddingCake: {
    category: "cake",
    vendor: "weddingCake",
    keywords: ["piece montee", "gateau", "cake", "dessert", "croquembouche"],
    relevant: (likes) => (likes.dessert?.length ?? 0) > 0,
  },
  officiant: {
    category: "officiant",
    vendor: "officiant",
    keywords: ["officiant", "celebrant", "laique"],
    relevant: (likes) => likes.ceremony?.includes("secular") ?? false,
  },
  honeymoon: {
    category: "honeymoon",
    vendor: "honeymoon",
    keywords: ["voyage", "lune de miel", "honeymoon", "trip"],
    relevant: (likes) => (likes.honeymoon?.length ?? 0) > 0,
  },
  rings: {
    category: "rings",
    vendor: "rings",
    keywords: ["alliance", "bague", "ring"],
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
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

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
  const labels = items.filter((item) => item.label).map((item) => normalize(item.label ?? ""));
  const categories = new Set(items.map((item) => item.category));
  const allocation = totalBudget && totalBudget > 0 ? allocateBudget(totalBudget, likes) : null;
  const amountOf = new Map(allocation?.lines.map((line) => [line.vendor, line.amount]));

  return BUDGET_SUGGESTIONS.filter((id) => {
    const rule = RULES[id];
    if (rule.relevant && !rule.relevant(likes)) return false;
    if (categories.has(rule.category)) return false;
    return !rule.keywords?.some((keyword) => labels.some((label) => mentions(label, keyword)));
  })
    .map((id) => ({
      id,
      category: RULES[id].category,
      estimate: amountOf.get(RULES[id].vendor) ?? null,
    }))
    .sort((a, b) => (b.estimate ?? 0) - (a.estimate ?? 0));
}

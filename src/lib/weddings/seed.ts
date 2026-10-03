import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { BudgetCategory } from "@/lib/budget/schema";
import type { TaskTemplateKey } from "@/lib/tasks/schema";
import type { createClient } from "@/utils/supabase/client";
import { addDaysToIsoDate } from "./dates";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Rétroplanning par défaut du MVP (marché FR), du plus lointain au plus proche. */
const DEFAULT_TASKS = [
  { key: "set_budget", offset: -330 },
  { key: "guest_list", offset: -300 },
  { key: "book_venue", offset: -280 },
  { key: "book_catering", offset: -240 },
  { key: "book_photographer", offset: -210 },
  { key: "choose_attire", offset: -180 },
  { key: "send_invitations", offset: -120 },
  { key: "seating_plan", offset: -30 },
] as const satisfies readonly { key: TaskTemplateKey; offset: number }[];

/** Répartition indicative du budget total, en part du total. */
const DEFAULT_BUDGET_SPLIT = [
  { category: "venue", share: 0.4 },
  { category: "catering", share: 0.3 },
  { category: "contingency", share: 0.1 },
] as const satisfies readonly { category: BudgetCategory; share: number }[];

type SeedableWedding = {
  id: string;
  wedding_date: string | null;
  total_budget: number | null;
};

/**
 * Injecte le rétroplanning et les lignes de budget par défaut d'un mariage.
 * Les tâches sont traduites à l'affichage via template_key ; title garde le
 * libellé dans la locale de création comme texte de secours.
 * Renvoie false en cas d'échec (journalisé), sans lever d'exception.
 */
export async function seedWeddingDefaults(
  supabase: ServerClient,
  wedding: SeedableWedding,
  locale: Locale,
): Promise<boolean> {
  const t = await getTranslations({
    locale,
    namespace: "Dashboard.timeline.templates",
  });

  const tasks = DEFAULT_TASKS.map(({ key, offset }) => ({
    wedding_id: wedding.id,
    template_key: key,
    title: t(key),
    target_offset_days: offset,
    due_date: wedding.wedding_date
      ? addDaysToIsoDate(wedding.wedding_date, offset)
      : null,
  }));

  const total = wedding.total_budget;
  const budgetItems =
    total === null
      ? []
      : DEFAULT_BUDGET_SPLIT.map(({ category, share }) => ({
          wedding_id: wedding.id,
          category,
          estimated_amount: Math.round(total * share),
        }));

  const [tasksResult, budgetResult] = await Promise.all([
    supabase.from("tasks").insert(tasks),
    budgetItems.length > 0
      ? supabase.from("budget_items").insert(budgetItems)
      : Promise.resolve({ error: null }),
  ]);

  if (tasksResult.error) {
    console.error("[seed] insert tasks:", tasksResult.error.code);
  }
  if (budgetResult.error) {
    console.error("[seed] insert budget_items:", budgetResult.error.code);
  }
  return !tasksResult.error && !budgetResult.error;
}

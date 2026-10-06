import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { DEFAULT_BUDGET_SPLIT } from "@/lib/budget/schema";
import { buildSchedule } from "@/lib/planning/schedule";
import { DEFAULT_PLANNING_ANSWERS } from "@/lib/planning/schema";
import type { createClient } from "@/utils/supabase/client";
import { todayIsoDate } from "./dates";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

type SeedableWedding = {
  id: string;
  wedding_date: string;
  total_budget: number | null;
  country_code: string | null;
};

/**
 * Injecte le rétroplanning et les lignes de budget par défaut d'un mariage.
 * Rétroplanning : catalogue complet calculé d'après le temps restant, avec
 * les réponses par défaut ; le questionnaire (page Rétroplanning) l'affine.
 * Les tâches sont traduites à l'affichage via template_key ; title garde le
 * libellé dans la locale de création comme texte de secours.
 * Renvoie false en cas d'échec (journalisé), sans lever d'exception.
 */
export async function seedWeddingDefaults(
  supabase: ServerClient,
  wedding: SeedableWedding,
  locale: Locale,
): Promise<boolean> {
  const t = await getTranslations({ locale, namespace: "Planning.tasks" });

  const schedule = buildSchedule({
    weddingDate: wedding.wedding_date,
    today: todayIsoDate(),
    answers: DEFAULT_PLANNING_ANSWERS,
    countryCode: wedding.country_code,
  });
  const tasks = schedule.tasks.map((task) => ({
    wedding_id: wedding.id,
    template_key: task.key,
    depends_on_key: task.dependsOn,
    category: task.category,
    title: t(task.key),
    target_offset_days: task.targetOffsetDays,
    due_date: task.dueDate,
  }));

  const total = wedding.total_budget;
  const budgetItems =
    total === null
      ? []
      : DEFAULT_BUDGET_SPLIT.map(({ category, share, section, lineKey }) => ({
          wedding_id: wedding.id,
          category,
          section,
          line_key: lineKey,
          // Indication de Céleste : n'entre pas dans la jauge tant que le couple
          // n'a pas saisi son propre montant prévu.
          estimated_amount: 0,
          suggested_amount: Math.round(total * share),
        }));

  const [tasksResult, budgetResult] = await Promise.all([
    tasks.length > 0 ? supabase.from("tasks").insert(tasks) : Promise.resolve({ error: null }),
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

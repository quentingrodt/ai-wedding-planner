"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { todayIsoDate } from "@/lib/weddings/dates";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getPlanningSetup,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { DONE_OPTION_TASKS } from "./catalog";
import { buildSchedule } from "./schedule";
import { planningAnswersSchema, type PlanningAnswersInput } from "./schema";
import { planTaskSync, type ExistingTask } from "./sync";

export type SavePlanningResult =
  | { ok: true; inserted: number; updated: number; deleted: number }
  | { ok: false; error: "invalid" | "unauthenticated" | "forbidden" | "noDate" | "generic" };

/**
 * Enregistre les réponses du questionnaire et recompose le rétroplanning
 * (planTaskSync) : tâches créées, recalées ou retirées selon les réponses et
 * le temps restant. Réservé aux mariés (owner, partner).
 *
 * Écritures PostgREST sans transaction : un échec partiel laisse un planning
 * cohérent tâche par tâche, et un nouvel envoi termine le travail.
 */
export async function savePlanningAnswers(
  input: PlanningAnswersInput,
): Promise<SavePlanningResult> {
  const parsed = planningAnswersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const answers = parsed.data;

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };

  let wedding: Awaited<ReturnType<typeof getCurrentWedding>>;
  let role: Awaited<ReturnType<typeof getCurrentMemberRole>>;
  let countryCode: string | null;
  try {
    wedding = await getCurrentWedding(supabase);
    if (!wedding) return { ok: false, error: "forbidden" };
    [role, { countryCode }] = await Promise.all([
      getCurrentMemberRole(supabase, wedding.id, userId),
      getPlanningSetup(supabase, wedding.id),
    ]);
  } catch {
    return { ok: false, error: "generic" };
  }
  if (role !== "owner" && role !== "partner") return { ok: false, error: "forbidden" };
  if (!wedding.wedding_date) return { ok: false, error: "noDate" };

  const { error: answersError } = await supabase
    .from("weddings")
    .update({ planning_answers: answers })
    .eq("id", wedding.id);
  if (answersError) {
    console.error("[planning] save answers:", answersError.code);
    return { ok: false, error: "generic" };
  }

  const { data: existing, error: tasksError } = await supabase
    .from("tasks")
    .select(
      "id, template_key, status, rescheduled, due_date, target_offset_days, category, depends_on_key",
    )
    .eq("wedding_id", wedding.id)
    .order("created_at", { ascending: true })
    .returns<ExistingTask[]>();
  if (tasksError) {
    console.error("[planning] read tasks:", tasksError.code);
    return { ok: false, error: "generic" };
  }

  const schedule = buildSchedule({
    weddingDate: wedding.wedding_date,
    today: todayIsoDate(),
    answers,
    countryCode,
  });
  const doneKeys = new Set<string>(
    answers.alreadyDone.flatMap((option) => DONE_OPTION_TASKS[option]),
  );
  const plan = planTaskSync(existing, schedule.tasks, doneKeys);

  // Libellé de secours dans la langue du couple (l'affichage traduit template_key).
  const t = await getTranslations({ locale: await getLocale(), namespace: "Planning.tasks" });
  const weddingId = wedding.id;

  const [insertResult, deleteResult, ...updateResults] = await Promise.all([
    plan.inserts.length > 0
      ? supabase.from("tasks").insert(
          plan.inserts.map((task) => ({
            wedding_id: weddingId,
            template_key: task.key,
            depends_on_key: task.dependsOn,
            category: task.category,
            title: t(task.key),
            target_offset_days: task.targetOffsetDays,
            status: task.done ? "done" : "todo",
            due_date: task.dueDate,
          })),
        )
      : Promise.resolve({ error: null }),
    plan.deletes.length > 0
      ? supabase.from("tasks").delete().in("id", plan.deletes).eq("status", "todo")
      : Promise.resolve({ error: null }),
    ...plan.updates.map(({ id, values }) =>
      supabase.from("tasks").update(values).eq("id", id),
    ),
  ]);

  const failures = [insertResult, deleteResult, ...updateResults].filter(
    (result) => result.error,
  );
  for (const failure of failures) {
    console.error("[planning] sync tasks:", failure.error?.code);
  }

  revalidatePath("/[locale]/(app)/planning", "page");
  revalidatePath("/[locale]/(app)/dashboard", "page");
  if (failures.length > 0) return { ok: false, error: "generic" };
  return {
    ok: true,
    inserted: plan.inserts.length,
    updated: plan.updates.length,
    deleted: plan.deletes.length,
  };
}

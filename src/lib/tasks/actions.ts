"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { daysBetween } from "@/lib/weddings/dates";
import { getCurrentUserId } from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { planDateCascade, type CascadeTask, type DateChange } from "./cascade";

const updateTaskDateSchema = z.object({
  taskId: z.uuid(),
  newDate: z.iso.date(),
});

export type UpdateTaskDateResult =
  | {
      ok: true;
      /** Dépendantes effectivement recalées. */
      dependents: number;
      /** Une échéance au moins a été ramenée à la veille du mariage. */
      capped: boolean;
      /** La tâche était déjà à cette date : rien n'a été écrit. */
      unchanged: boolean;
    }
  | { ok: false; error: "invalid" | "unauthenticated" | "notFound" | "generic" };

/** Bornes de tasks.target_offset_days (cf. migration 000003). */
const MIN_OFFSET_DAYS = -1000;

/**
 * Déplace l'échéance d'une tâche et recale ses dépendantes du même nombre de
 * jours (moteur pur planDateCascade), sans dépasser la veille du mariage.
 * Accessible à tous les membres du mariage : la RLS de tasks fait foi.
 *
 * Les écritures passent par PostgREST, sans transaction : en cas d'échec
 * partiel, seules les dépendantes écrites sont comptées.
 */
export async function updateTaskDate(
  taskId: string,
  newDate: string,
): Promise<UpdateTaskDateResult> {
  const parsed = updateTaskDateSchema.safeParse({ taskId, newDate });
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) return { ok: false, error: "unauthenticated" };

  // Tâche cible (RLS : invisible si l'utilisateur n'est pas membre du mariage).
  const { data: target, error: targetError } = await supabase
    .from("tasks")
    .select("wedding_id, weddings ( wedding_date )")
    .eq("id", parsed.data.taskId)
    .maybeSingle<{ wedding_id: string; weddings: { wedding_date: string | null } | null }>();

  if (targetError) {
    console.error("[tasks] updateTaskDate target:", targetError.code);
    return { ok: false, error: "generic" };
  }
  if (!target) return { ok: false, error: "notFound" };

  const weddingDate = target.weddings?.wedding_date ?? null;
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id, template_key, depends_on_key, due_date, status")
    .eq("wedding_id", target.wedding_id)
    .returns<CascadeTask[]>();

  if (tasksError) {
    console.error("[tasks] updateTaskDate tasks:", tasksError.code);
    return { ok: false, error: "generic" };
  }

  const cascade = planDateCascade({
    tasks,
    targetId: parsed.data.taskId,
    newDate: parsed.data.newDate,
    weddingDate,
  });
  if (!cascade) return { ok: false, error: "notFound" };

  const current = tasks.find((task) => task.id === parsed.data.taskId);
  if (current?.due_date === cascade.target.dueDate) {
    return { ok: true, dependents: 0, capped: cascade.target.capped, unchanged: true };
  }

  // L'écart au mariage (J-n) suit l'échéance ; borné comme en base.
  const write = async ({ id, dueDate }: DateChange) => {
    const { data, error } = await supabase
      .from("tasks")
      .update({
        due_date: dueDate,
        ...(weddingDate && {
          target_offset_days: Math.max(MIN_OFFSET_DAYS, daysBetween(weddingDate, dueDate)),
        }),
      })
      .eq("id", id)
      .select("id");
    if (error || data.length === 0) {
      console.error("[tasks] updateTaskDate write:", error?.code ?? "not_found");
      return false;
    }
    return true;
  };

  if (!(await write(cascade.target))) return { ok: false, error: "generic" };
  const written = await Promise.all(cascade.dependents.map(write));

  revalidatePath("/[locale]/(app)/dashboard", "page");
  return {
    ok: true,
    dependents: written.filter(Boolean).length,
    capped: cascade.target.capped || cascade.dependents.some((change) => change.capped),
    unchanged: false,
  };
}

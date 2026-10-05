"use server";

import { revalidatePath } from "next/cache";
import {
  toggleTaskSchema,
  type ToggleTaskInput,
  type ToggleTaskResult,
} from "@/lib/tasks/schema";
import { getCurrentUserId } from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

/** Coche ou décoche une tâche ; la RLS limite l'accès aux membres du mariage. */
export async function toggleTask(
  input: ToggleTaskInput,
): Promise<ToggleTaskResult> {
  const parsed = toggleTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { taskId, done } = parsed.data;

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) return { ok: false };

  // Sans ligne renvoyée, la tâche n'existe pas ou n'est pas accessible (RLS).
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: done ? "done" : "todo" })
    .eq("id", taskId)
    .select("id");

  if (error || data.length === 0) {
    console.error("[dashboard] toggleTask:", error?.code ?? "not_found");
    return { ok: false };
  }

  revalidatePath("/[locale]/(app)/dashboard", "page");
  return { ok: true };
}

import { PLANNING_TASK_KEYS } from "./catalog";
import type { ScheduledTask } from "./schedule";
import type { TaskCategory } from "./schema";

/*
 * Rapprochement entre le rétroplanning calculé et les tâches en base, sans
 * écrire : la Server Action applique le plan renvoyé.
 *
 * - Tâche du catalogue retenue : créée si absente, sinon échéance recalculée,
 *   sauf si elle est terminée ou déplacée à la main (rescheduled).
 * - Tâche déclarée « déjà réglée » (doneKeys) : créée ou passée terminée ;
 *   une tâche n'est jamais décochée par le recalcul.
 * - Tâche du catalogue écartée par les réponses : supprimée si elle reste à
 *   faire ; une tâche terminée est conservée.
 * - Tâche libre (sans template_key) : jamais modifiée.
 */

export type ExistingTask = {
  id: string;
  template_key: string | null;
  status: "todo" | "done";
  rescheduled: boolean;
  due_date: string | null;
  target_offset_days: number;
  category: string | null;
  depends_on_key: string | null;
};

export type TaskPatch = {
  id: string;
  values: Partial<{
    due_date: string;
    target_offset_days: number;
    category: TaskCategory;
    depends_on_key: string | null;
    status: "done";
  }>;
};

export type TaskInsert = ScheduledTask & { done: boolean };

export type TaskSyncPlan = {
  inserts: TaskInsert[];
  updates: TaskPatch[];
  deletes: string[];
};

const catalogKeys = new Set<string>(PLANNING_TASK_KEYS);

export function planTaskSync(
  existing: readonly ExistingTask[],
  scheduled: readonly ScheduledTask[],
  doneKeys: ReadonlySet<string> = new Set(),
): TaskSyncPlan {
  const byKey = new Map<string, ExistingTask>();
  const duplicates: ExistingTask[] = [];
  for (const task of existing) {
    if (task.template_key === null || !catalogKeys.has(task.template_key)) continue;
    if (byKey.has(task.template_key)) duplicates.push(task);
    else byKey.set(task.template_key, task);
  }

  const plan: TaskSyncPlan = { inserts: [], updates: [], deletes: [] };
  const kept = new Set<string>();

  for (const task of scheduled) {
    const row = byKey.get(task.key);
    if (!row) {
      plan.inserts.push({ ...task, done: doneKeys.has(task.key) });
      continue;
    }
    kept.add(task.key);

    const values: TaskPatch["values"] = {};
    if (row.category !== task.category) values.category = task.category;
    if (row.depends_on_key !== task.dependsOn) values.depends_on_key = task.dependsOn;
    if (row.status === "todo" && !row.rescheduled) {
      if (row.due_date !== task.dueDate) values.due_date = task.dueDate;
      if (row.target_offset_days !== task.targetOffsetDays) {
        values.target_offset_days = task.targetOffsetDays;
      }
    }
    if (row.status === "todo" && doneKeys.has(task.key)) values.status = "done";
    if (Object.keys(values).length > 0) plan.updates.push({ id: row.id, values });
  }

  for (const row of [...byKey.values(), ...duplicates]) {
    const isDuplicate = duplicates.includes(row);
    if ((isDuplicate || !kept.has(row.template_key!)) && row.status === "todo") {
      plan.deletes.push(row.id);
    }
  }
  return plan;
}

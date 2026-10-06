import { z } from "zod";
import { PLANNING_TASK_KEYS, type PlanningTaskKey } from "@/lib/planning/catalog";
import { TASK_CATEGORIES } from "@/lib/planning/schema";

export const TASK_STATUSES = ["todo", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Tâches du catalogue (src/lib/planning/catalog.ts), traduites via Planning.tasks.<key>. */
export type TaskTemplateKey = PlanningTaskKey;

export function isTaskTemplateKey(value: string | null): value is TaskTemplateKey {
  return (PLANNING_TASK_KEYS as readonly (string | null)[]).includes(value);
}

/** Ligne de la table tasks, telle que lue par le dashboard. */
export type Task = {
  id: string;
  template_key: string | null;
  title: string;
  status: TaskStatus;
  target_offset_days: number;
  due_date: string | null;
};

/** Ligne de la table tasks, telle que lue par le rétroplanning. */
export type PlanningTaskRow = Task & {
  category: string | null;
  depends_on_key: string | null;
  rescheduled: boolean;
};

/** Limite alignée sur la contrainte CHECK de tasks.title (000003). */
export const TASK_TITLE_MAX = 200;

/** Étape personnelle ajoutée par le couple ou un témoin. */
export const addTaskSchema = z.object({
  title: z.string().trim().min(1).max(TASK_TITLE_MAX),
  dueDate: z.iso.date(),
  // Saisie vide : étape sans chapitre (affichée comme « Étape personnelle »).
  category: z
    .enum(TASK_CATEGORIES)
    .or(z.literal(""))
    .transform((value) => (value === "" ? null : value)),
});
export type AddTaskInput = z.input<typeof addTaskSchema>;
export type AddTaskField = "title" | "dueDate";

export type TaskActionResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "unauthenticated" | "forbidden" | "tooLate" | "generic" };

export const toggleTaskSchema = z.object({
  taskId: z.uuid(),
  done: z.boolean(),
});
export type ToggleTaskInput = z.infer<typeof toggleTaskSchema>;

export type ToggleTaskResult = { ok: true } | { ok: false };

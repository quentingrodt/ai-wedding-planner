import { z } from "zod";

export const TASK_STATUSES = ["todo", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Clés des tâches par défaut, traduites via Dashboard.timeline.templates.<key>. */
export const TASK_TEMPLATE_KEYS = [
  "set_budget",
  "guest_list",
  "book_venue",
  "book_catering",
  "book_photographer",
  "choose_attire",
  "send_invitations",
  "seating_plan",
] as const;
export type TaskTemplateKey = (typeof TASK_TEMPLATE_KEYS)[number];

export function isTaskTemplateKey(value: string | null): value is TaskTemplateKey {
  return (TASK_TEMPLATE_KEYS as readonly (string | null)[]).includes(value);
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

export const toggleTaskSchema = z.object({
  taskId: z.uuid(),
  done: z.boolean(),
});
export type ToggleTaskInput = z.infer<typeof toggleTaskSchema>;

export type ToggleTaskResult = { ok: true } | { ok: false };

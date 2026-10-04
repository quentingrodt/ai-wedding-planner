import { addDaysToIsoDate, daysBetween } from "@/lib/weddings/dates";
import type { TaskStatus } from "./schema";

/** Tâche telle que la cascade a besoin de la lire. */
export type CascadeTask = {
  id: string;
  template_key: string | null;
  depends_on_key: string | null;
  due_date: string | null;
  status: TaskStatus;
};

/** Nouvelle échéance d'une tâche ; capped si elle a été ramenée à la veille du mariage. */
export type DateChange = { id: string; dueDate: string; capped: boolean };

export type DateCascade = {
  /** Écart en jours appliqué aux dépendantes (0 : pas de cascade). */
  delta: number;
  target: DateChange;
  dependents: DateChange[];
};

/**
 * Calcule le déplacement d'une tâche et de ses dépendantes (sans écrire en base).
 *
 * - delta : nombre de jours entre l'ancienne et la nouvelle échéance, calculé
 *   à minuit UTC (daysBetween) pour ne jamais dépendre de l'heure d'été.
 * - Cascade transitive (A → B → C) par template_key, chaque clé n'étant
 *   visitée qu'une fois : pas de boucle possible.
 * - Les tâches terminées ou sans échéance ne bougent pas et n'entraînent pas
 *   leurs propres dépendantes.
 * - Garde-fou : aucune échéance après la veille du mariage (dates ISO
 *   comparables comme des chaînes).
 */
export function planDateCascade({
  tasks,
  targetId,
  newDate,
  weddingDate,
}: {
  tasks: readonly CascadeTask[];
  targetId: string;
  newDate: string;
  weddingDate: string | null;
}): DateCascade | null {
  const target = tasks.find((task) => task.id === targetId);
  if (!target) return null;

  const latest = weddingDate ? addDaysToIsoDate(weddingDate, -1) : null;
  const cap = (date: string) => (latest !== null && date > latest ? latest : date);

  const targetDate = cap(newDate);
  const delta = target.due_date ? daysBetween(target.due_date, targetDate) : 0;
  const result: DateCascade = {
    delta,
    target: { id: target.id, dueDate: targetDate, capped: targetDate !== newDate },
    dependents: [],
  };
  if (delta === 0 || !target.template_key) return result;

  const visited = new Set([target.template_key]);
  const queue = [target.template_key];
  while (queue.length > 0) {
    const parentKey = queue.shift();
    for (const task of tasks) {
      if (task.depends_on_key !== parentKey || task.id === target.id) continue;
      if (task.status === "done" || task.due_date === null) continue;

      const shifted = addDaysToIsoDate(task.due_date, delta);
      const dueDate = cap(shifted);
      if (dueDate !== task.due_date) {
        result.dependents.push({ id: task.id, dueDate, capped: dueDate !== shifted });
      }
      if (task.template_key && !visited.has(task.template_key)) {
        visited.add(task.template_key);
        queue.push(task.template_key);
      }
    }
  }
  return result;
}

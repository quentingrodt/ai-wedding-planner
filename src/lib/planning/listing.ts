import { isTaskTemplateKey, type PlanningTaskRow, type TaskTemplateKey } from "@/lib/tasks/schema";
import { buildSchedule, type ScheduledTask } from "./schedule";
import {
  DEFAULT_PLANNING_ANSWERS,
  TASK_CATEGORIES,
  type PlanningAnswers,
  type TaskCategory,
  type TaskPace,
} from "./schema";

/*
 * Rétroplanning prêt à afficher (page et export PDF), sans traduction :
 * rythme recalculé à l'instant, regroupement « à rattraper » puis mois par
 * mois, et les étapes sans échéance à la fin.
 */

export type PlanningEntry = {
  row: PlanningTaskRow;
  /** Clé du catalogue, ou null pour une étape personnelle. */
  key: TaskTemplateKey | null;
  category: TaskCategory | null;
  done: boolean;
  overdue: boolean;
  /** Rythme calculé ; null s'il est confortable, terminé ou hors catalogue. */
  pace: Exclude<TaskPace, "comfortable"> | null;
  /** "overdue", "none" ou mois « YYYY-MM ». */
  groupKey: string;
};

export type PlanningListing = {
  entries: PlanningEntry[];
  /** Rythme d'ensemble des étapes restantes. */
  tension: TaskPace;
  doneCount: number;
};

const isCategory = (value: string | null): value is TaskCategory =>
  (TASK_CATEGORIES as readonly (string | null)[]).includes(value);

const groupRank = (key: string) => (key === "overdue" ? 0 : key === "none" ? 2 : 1);

export function describePlanning({
  rows,
  answers,
  countryCode,
  weddingDate,
  today,
}: {
  rows: readonly PlanningTaskRow[];
  answers: PlanningAnswers | null;
  countryCode: string | null;
  weddingDate: string | null;
  today: string;
}): PlanningListing {
  const schedule =
    weddingDate === null
      ? null
      : buildSchedule({
          weddingDate,
          today,
          answers: answers ?? DEFAULT_PLANNING_ANSWERS,
          countryCode,
        });
  const scheduled = new Map<string, ScheduledTask>(
    schedule?.tasks.map((task) => [task.key, task]) ?? [],
  );

  const entries = rows
    .map((row, index) => {
      const done = row.status === "done";
      const overdue = !done && row.due_date !== null && row.due_date < today;
      const key = isTaskTemplateKey(row.template_key) ? row.template_key : null;
      const pace = done || !key ? null : (scheduled.get(key)?.pace ?? null);
      const entry: PlanningEntry = {
        row,
        key,
        category: isCategory(row.category) ? row.category : null,
        done,
        overdue,
        pace: pace === "comfortable" ? null : pace,
        groupKey: overdue ? "overdue" : row.due_date === null ? "none" : row.due_date.slice(0, 7),
      };
      return { entry, index };
    })
    .sort(
      (a, b) =>
        groupRank(a.entry.groupKey) - groupRank(b.entry.groupKey) ||
        a.entry.groupKey.localeCompare(b.entry.groupKey) ||
        a.index - b.index,
    )
    .map(({ entry }) => entry);

  const open = entries.filter((entry) => !entry.done);
  const tension: TaskPace = open.some((entry) => entry.pace === "urgent")
    ? "urgent"
    : open.some((entry) => entry.pace === "tight")
      ? "tight"
      : "comfortable";

  return { entries, tension, doneCount: entries.length - open.length };
}

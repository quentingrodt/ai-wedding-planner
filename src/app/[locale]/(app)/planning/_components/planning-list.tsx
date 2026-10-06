"use client";

import { ArrowRightIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  DueDate,
  TaskCheckbox,
  useTaskToggle,
  type DisplayTask,
} from "@/components/tasks/task-parts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { PlanningHref } from "@/lib/planning/catalog";
import { TASK_CATEGORIES, type TaskCategory, type TaskPace } from "@/lib/planning/schema";
import { deleteTask } from "@/lib/tasks/actions";
import { cn } from "@/lib/utils";

/** Chapitre d'une tâche ; « custom » pour une étape personnelle sans chapitre. */
export type PlanningCategory = TaskCategory | "custom";

/** Tâche du rétroplanning, entièrement préparée côté serveur. */
export type PlanningItem = DisplayTask & {
  category: PlanningCategory;
  categoryLabel: string;
  /** Étape ajoutée par le couple (hors catalogue) : supprimable. */
  custom: boolean;
  /** Rythme calculé ; null s'il est confortable ou que la tâche est libre. */
  pace: Exclude<TaskPace, "comfortable"> | null;
  /** Conseil pour une tâche urgente. */
  advice: string | null;
  href: PlanningHref | null;
  /** Regroupement : "overdue", "none" ou mois (YYYY-MM) ; libellé déjà formaté. */
  groupKey: string;
  groupLabel: string;
};

type PlanningListProps = {
  items: PlanningItem[];
  latestDate: string | null;
};

const FILTERS = ["all", ...TASK_CATEGORIES, "custom"] as const;
type Filter = (typeof FILTERS)[number];

/** Rétroplanning complet, par mois d'échéance (les retards d'abord), filtrable. */
export function PlanningList({ items, latestDate }: PlanningListProps) {
  const t = useTranslations("Planning");
  const { tasks, toggle } = useTaskToggle(items);
  const [filter, setFilter] = useState<Filter>("all");
  const [hideDone, setHideDone] = useState(false);

  if (tasks.length === 0) {
    return <p className="rounded-3xl bg-linen px-6 py-5 text-stone">{t("empty")}</p>;
  }

  // Seuls les chapitres présents dans la liste sont proposés.
  const present = new Set(tasks.map((task) => task.category));
  const filters = FILTERS.filter((key) => key === "all" || present.has(key));
  const visible = tasks.filter(
    (task) => (filter === "all" || task.category === filter) && !(hideDone && task.done),
  );

  const groups: { key: string; label: string; items: PlanningItem[] }[] = [];
  for (const task of visible) {
    const last = groups.at(-1);
    if (last?.key === task.groupKey) last.items.push(task);
    else groups.push({ key: task.groupKey, label: task.groupLabel, items: [task] });
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <div
          role="group"
          aria-label={t("filters.label")}
          className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {filters.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 text-sm transition-colors",
                filter === key
                  ? "bg-charcoal text-ivory"
                  : "bg-card text-stone ring-1 ring-border hover:bg-linen",
              )}
            >
              {key === "all"
                ? t("filters.all")
                : key === "custom"
                  ? t("custom")
                  : t(`categories.${key}`)}
            </button>
          ))}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 self-start text-sm text-stone">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(event) => setHideDone(event.target.checked)}
            className="size-4 accent-sage-deep"
          />
          {t("filters.hideDone")}
        </label>
      </div>

      {groups.length === 0 && <p className="text-stone">{t("filters.empty")}</p>}

      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`month-${group.key}`} className="flex flex-col gap-5">
          <h2
            id={`month-${group.key}`}
            className={cn(
              "font-serif text-2xl first-letter:uppercase",
              group.key === "overdue" && "text-terracotta",
            )}
          >
            {group.label}
          </h2>
          <ol className="flex flex-col divide-y divide-border rounded-3xl bg-card ring-1 ring-border">
            {group.items.map((task) => (
              <li
                key={task.id}
                className={cn(
                  "flex items-start gap-4 px-5 py-4 transition-opacity duration-500 sm:px-6",
                  task.done && "opacity-50",
                )}
              >
                <TaskCheckbox task={task} onToggle={(done) => toggle(task, done)} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <label
                      htmlFor={`task-${task.id}`}
                      className={cn(
                        "cursor-pointer wrap-break-word decoration-sage",
                        task.done && "line-through",
                      )}
                    >
                      {task.label}
                    </label>
                    {task.href && !task.done && (
                      <Link
                        href={task.href}
                        className="group inline-flex shrink-0 items-center gap-1 text-sm font-medium text-sage-deep"
                      >
                        {t("open")}
                        <ArrowRightIcon
                          aria-hidden
                          className="size-3.5 transition-transform group-hover:translate-x-0.5"
                        />
                      </Link>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <DueDate task={task} latestDate={latestDate} />
                    <span className="text-xs tracking-wide text-stone/80 uppercase">
                      {task.categoryLabel}
                    </span>
                    {task.pace && !task.done && (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          task.pace === "urgent"
                            ? "bg-terracotta/10 text-terracotta"
                            : "bg-sand/50 text-stone",
                        )}
                      >
                        {t(`pace.${task.pace}`)}
                      </span>
                    )}
                  </div>
                  {task.advice && !task.done && (
                    <p className="text-sm text-pretty text-stone">{task.advice}</p>
                  )}
                </div>
                {task.custom && <DeleteTaskButton task={task} />}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** Suppression d'une étape personnelle, après confirmation. */
function DeleteTaskButton({ task }: { task: PlanningItem }) {
  const t = useTranslations("Planning.delete");
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof deleteTask>>;
      try {
        result = await deleteTask(task.id);
      } catch {
        result = { ok: false, error: "generic" };
      }
      if (result.ok) toast(t("deleted", { task: task.label }));
      else toast.error(t("error"));
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          aria-label={t("trigger", { task: task.label })}
          className="-mt-0.5 shrink-0 text-stone hover:text-terracotta"
        >
          <Trash2Icon aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-xl">
            {t("title", { task: task.label })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm}>
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

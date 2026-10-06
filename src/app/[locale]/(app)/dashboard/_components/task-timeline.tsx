"use client";

import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DueDate,
  TaskCheckbox,
  useTaskToggle,
  type DisplayTask,
} from "@/components/tasks/task-parts";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type TimelineTask = DisplayTask;

type TaskTimelineProps = {
  tasks: TimelineTask[];
  /** Dernière échéance possible (veille du mariage), ou null sans date de mariage. */
  latestDate: string | null;
};

/**
 * Timeline verticale des prochaines tâches : cochables avec retour instantané,
 * et échéances modifiables (les tâches dépendantes suivent, cf. updateTaskDate).
 */
export function TaskTimeline({ tasks, latestDate }: TaskTimelineProps) {
  const t = useTranslations("Dashboard.timeline");
  const { tasks: optimisticTasks, toggle } = useTaskToggle(tasks);

  return (
    <section
      aria-labelledby="timeline-title"
      className="flex flex-col gap-6 rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-[0.2em] text-sage-deep uppercase">
          {t("eyebrow")}
        </p>
        <h2 id="timeline-title" className="text-2xl">
          {t("title")}
        </h2>
      </div>

      {optimisticTasks.length === 0 ? (
        <p className="text-stone">{t("empty")}</p>
      ) : (
        <ol className="relative flex flex-col gap-6 before:absolute before:top-3 before:bottom-3 before:left-3 before:w-px before:bg-sand">
          {optimisticTasks.map((task) => (
            <li
              key={task.id}
              className={cn(
                "relative flex items-start gap-4 transition-opacity duration-500",
                task.done && "opacity-50",
              )}
            >
              <TaskCheckbox task={task} onToggle={(done) => toggle(task, done)} />
              <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
                <label
                  htmlFor={`task-${task.id}`}
                  className={cn(
                    "cursor-pointer wrap-break-word decoration-sage transition-colors",
                    task.done && "line-through",
                  )}
                >
                  {task.label}
                </label>
                <DueDate task={task} latestDate={latestDate} />
              </div>
            </li>
          ))}
        </ol>
      )}

      <Link
        href="/planning"
        className="group inline-flex items-center gap-2 self-start text-sm font-medium text-sage-deep"
      >
        {t("seeAll")}
        <ArrowRightIcon aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </section>
  );
}

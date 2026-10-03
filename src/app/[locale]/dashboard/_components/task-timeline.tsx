"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toggleTask } from "../actions";

/** Tâche prête à afficher : libellé traduit et échéance formatée côté serveur. */
export type TimelineTask = {
  id: string;
  label: string;
  /** Échéance déjà formatée, ou null si le mariage n'a pas de date. */
  dueLabel: string | null;
  overdue: boolean;
  done: boolean;
};

type Toggle = { id: string; done: boolean };

/** Timeline verticale des prochaines tâches, cochables avec retour instantané. */
export function TaskTimeline({ tasks }: { tasks: TimelineTask[] }) {
  const t = useTranslations("Dashboard.timeline");
  const [, startTransition] = useTransition();
  const [optimisticTasks, applyToggle] = useOptimistic(
    tasks,
    (state: TimelineTask[], { id, done }: Toggle) =>
      state.map((task) => (task.id === id ? { ...task, done } : task)),
  );

  function toggle(task: TimelineTask, done: boolean) {
    startTransition(async () => {
      // Sans effet si la tâche a déjà quitté la liste (annulation) :
      // la revalidation la fera réapparaître.
      applyToggle({ id: task.id, done });
      const result = await toggleTask({ taskId: task.id, done });
      if (!result.ok) {
        toast.error(t("error"));
        return;
      }
      if (done) {
        toast(t("doneToast", { task: task.label }), {
          action: { label: t("undo"), onClick: () => toggle(task, false) },
        });
      }
    });
  }

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
              <span className="relative grid size-6 shrink-0 place-items-center">
                <input
                  type="checkbox"
                  id={`task-${task.id}`}
                  checked={task.done}
                  onChange={(event) => toggle(task, event.target.checked)}
                  className="peer size-6 cursor-pointer appearance-none rounded-full border border-sage bg-card transition-colors duration-300 checked:border-sage checked:bg-sage hover:bg-sage-soft checked:hover:bg-sage focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                />
                <CheckIcon
                  aria-hidden
                  strokeWidth={2.5}
                  className="pointer-events-none absolute size-3.5 text-ivory opacity-0 transition-opacity duration-300 peer-checked:opacity-100"
                />
              </span>
              <label
                htmlFor={`task-${task.id}`}
                className="flex min-w-0 cursor-pointer flex-col gap-1 pt-0.5"
              >
                <span
                  className={cn(
                    "wrap-break-word decoration-sage transition-colors",
                    task.done && "line-through",
                  )}
                >
                  {task.label}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    task.overdue && !task.done ? "text-terracotta" : "text-stone",
                  )}
                >
                  {task.overdue
                    ? t("overdue")
                    : task.dueLabel === null
                      ? t("noDate")
                      : t("due", { date: task.dueLabel })}
                </span>
              </label>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
